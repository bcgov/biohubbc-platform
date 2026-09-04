import express, { NextFunction, Request, Response } from 'express';
import { loadPublicKeys } from './auth/verify-token.js';
import { config } from './config.js';
import { TileError } from './errors/tile-error.js';
import { startMetricsReporting } from './metrics.js';
import { corsMiddleware } from './middleware/cors.js';
import { ipRateLimiter, jtiRateLimiter } from './middleware/rate-limit.js';
import { authenticateTileRequest, handleTileRequest, parseTilePath } from './routes/martin.js';
import { getLogger } from './utils/logger.js';

const defaultLog = getLogger('app');

export const app: express.Express = express();

// Exactly one proxy hop sits in front of the gateway (the OpenShift router), so the client address
// is the last entry of X-Forwarded-For. Locally there is no proxy and req.ip is the socket peer.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(corsMiddleware);

/**
 * Health endpoint for the container healthcheck and the Kubernetes probes.
 *
 * Deliberately reports only on the gateway itself and does not call Martin: Martin has its own
 * probes, and a dependency check here would take the gateway out of service for a transient
 * upstream blip, turning a partial outage into a total one.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// The single public route. Every stage runs in order: validate the path, verify the token, apply the
// per token budget, then serve. Anything that does not match falls through to the 404 handler.
app.get('/martin/*', ipRateLimiter, parseTilePath, authenticateTileRequest, jtiRateLimiter, handleTileRequest);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ name: 'Not Found', status: 404, message: 'Not found' });
});

// Error handler. Mirrors the API's error shape, and never echoes upstream detail.

app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  const status = error instanceof TileError ? error.status : 500;
  const message = error instanceof TileError ? error.message : 'Internal server error';

  if (status >= 500) {
    // NOTE: log the path and status only. The Authorization header is never logged.
    defaultLog.error({ message: 'Tile request failed', path: req.path, status, error: error.message });
  }

  res.status(status).json({ name: error.name || 'Error', status, message });
});

/**
 * Start the gateway.
 *
 * @return {*}
 */
export const start = () => {
  // Fail fast on a missing or empty key directory rather than on the first tile request.
  loadPublicKeys();

  startMetricsReporting();

  return app.listen(config.port, () => {
    defaultLog.info({
      message: 'Martin Gateway started',
      port: config.port,
      martinUrl: config.martinUrl,
      allowedSources: config.allowedSources,
      zoom: `${config.minZoom}-${config.maxZoom}`,
      sourceVersion: config.sourceVersion
    });
  });
};

// Only listen when executed directly, so tests can import the app without binding a port.
if (process.env.NODE_ENV !== 'test') {
  start();
}

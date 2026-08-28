import http from 'node:http';
import https from 'node:https';
import { config } from '../config.js';
import { badGateway } from '../errors/tile-error.js';
import { getLogger } from '../utils/logger.js';

const defaultLog = getLogger('upstream/martin-client');

const martinUrl = new URL(config.martinUrl);
const isHttps = martinUrl.protocol === 'https:';
const transport = isHttps ? https : http;

/** Keep alive so a viewport pan reuses one connection rather than opening a socket per tile. */
const agent = new (isHttps ? https.Agent : http.Agent)({ keepAlive: true, maxSockets: 64 });

/**
 * Response metadata preserved verbatim from Martin. `cache-control` is deliberately excluded: tiles are
 * per-user authorized content, so the tiles route sets its own `Cache-Control: private` rather than
 * forwarding whatever caching directive Martin emits (which a shared cache could otherwise honour).
 */
export const PRESERVED_HEADERS = ['content-type', 'content-encoding', 'etag', 'last-modified'];

export interface UpstreamTileResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  /** Upstream round trip, milliseconds. */
  durationMs: number;
}

/**
 * Fetch a tile from Martin.
 *
 * Deliberately implemented with `node:http` rather than `fetch`/undici. Global fetch transparently
 * decompresses gzip responses and drops the `Content-Encoding` header, which would force the gateway
 * to either serve wrongly labelled bytes or re-compress every tile. Martin already gzips tiles, so
 * the bytes are passed through untouched.
 *
 * @param {string} pathname Already validated and constructed by the caller. Never client supplied.
 * @return {*}  {Promise<UpstreamTileResponse>}
 */
export const fetchTile = (pathname: string): Promise<UpstreamTileResponse> => {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const request = transport.request(
      {
        protocol: martinUrl.protocol,
        hostname: martinUrl.hostname,
        port: martinUrl.port,
        path: pathname,
        method: 'GET',
        agent,
        timeout: config.martinTimeoutMs,
        headers: {
          // Always request gzip so there is exactly one cached representation per tile.
          'accept-encoding': 'gzip'
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        let aborted = false;

        response.on('data', (chunk: Buffer) => {
          if (aborted) {
            return;
          }

          totalBytes += chunk.length;

          // No legitimate tile approaches this size. Refuse it rather than buffering an unbounded
          // response from Martin into gateway memory.
          if (totalBytes > config.maxTileBytes) {
            aborted = true;
            request.destroy();
            defaultLog.error({
              message: 'Martin response exceeded the maximum tile size',
              pathname,
              maxBytes: config.maxTileBytes
            });
            reject(badGateway());
            return;
          }

          chunks.push(chunk);
        });

        // Without this handler a mid-stream socket failure (eg: Martin restarting) emits an
        // unhandled 'error' on the response, crashing the gateway process instead of failing the
        // one tile.
        response.on('error', (error: Error) => {
          defaultLog.error({ message: 'Martin response stream failed', pathname, error: error.message });
          reject(badGateway());
        });

        response.on('end', () => {
          const status = response.statusCode ?? 502;

          const headers: Record<string, string> = {};

          for (const header of PRESERVED_HEADERS) {
            const value = response.headers[header];

            if (typeof value === 'string') {
              headers[header] = value;
            }
          }

          resolve({
            status,
            headers,
            body: Buffer.concat(chunks),
            durationMs: Date.now() - startedAt
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy();
      defaultLog.error({ message: 'Martin request timed out', pathname, timeoutMs: config.martinTimeoutMs });
      reject(badGateway());
    });

    request.on('error', (error) => {
      defaultLog.error({ message: 'Martin request failed', pathname, error: error.message });
      reject(badGateway());
    });

    request.end();
  });
};

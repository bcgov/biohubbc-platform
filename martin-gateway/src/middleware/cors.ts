import { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

/**
 * CORS middleware.
 *
 * Hand rolled to match the API (`api/src/app.ts`), which sets the same headers directly rather than
 * depending on the `cors` package.
 *
 * In OpenShift the gateway is served under `/martin` on the app's own hostname, so tile requests are
 * same origin and no preflight occurs. This exists for local development, where the app and the
 * gateway are on different ports, and it must allow the `Authorization` header because MapLibre
 * attaches the tile token there.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', config.allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  // Let the browser read the cache validator so conditional requests work.
  res.setHeader('Access-Control-Expose-Headers', 'ETag, Content-Encoding, X-Martin-Cache');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};

import { NextFunction, Request, Response } from 'express';
import { verifyMartinToken } from '../auth/verify-token.js';
import { buildCacheKey, CachedTile, resolveTile } from '../cache/tile-cache.js';
import { config } from '../config.js';
import { badGateway, forbidden, notFound } from '../errors/tile-error.js';
import { recordCacheHit, recordCacheMiss, recordUpstreamError } from '../metrics.js';
import { fetchTile } from '../upstream/martin-client.js';
import { getLogger } from '../utils/logger.js';

const defaultLog = getLogger('routes/martin');

/**
 * The ONLY request shape the gateway serves: `/martin/{source}/{z}/{x}/{y}`.
 *
 * The source segment is restricted to word characters, so a composite source request such as
 * `/martin/a,b/1/0/0` cannot match. Martin supports composite sources, and they would let a caller
 * join an approved source to an unapproved one, so they are rejected structurally rather than by the
 * allowlist alone. Every other Martin endpoint (`/catalog`, TileJSON at `/{source}`, sprites, fonts,
 * styles) is unreachable because nothing else matches this pattern.
 */
export const MARTIN_PATH_REGEX = /^\/martin\/([A-Za-z0-9_]+)\/(\d{1,2})\/(\d{1,10})\/(\d{1,10})$/;

export interface ParsedTileRequest {
  source: string;
  z: number;
  x: number;
  y: number;
}

/**
 * Validate the request path and reject anything that is not an allowlisted tile request.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export const parseTilePath = (req: Request, res: Response, next: NextFunction) => {
  try {
    // `req.path` excludes the query string, so client supplied parameters cannot influence routing.
    const match = MARTIN_PATH_REGEX.exec(req.path);

    if (!match) {
      throw notFound();
    }

    const [, source, rawZ, rawX, rawY] = match;

    if (!config.allowedSources.includes(source)) {
      throw forbidden('Unknown tile source');
    }

    const z = Number(rawZ);
    const x = Number(rawX);
    const y = Number(rawY);

    if (z < config.minZoom || z > config.maxZoom) {
      throw notFound('Zoom level out of range');
    }

    // Reject coordinates that cannot exist at this zoom, so nonsense never reaches PostGIS.
    const maxIndex = 2 ** z - 1;

    if (x > maxIndex || y > maxIndex) {
      throw notFound('Tile coordinates out of range');
    }

    res.locals.tile = { source, z, x, y } satisfies ParsedTileRequest;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Verify the tile token locally.
 *
 * Runs before the per token rate limiter, which keys on the verified `jti`.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
export const authenticateTileRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { source } = res.locals.tile as ParsedTileRequest;

    res.locals.tokenClaims = verifyMartinToken(req.headers.authorization, source);

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Serve the tile, from cache when possible.
 *
 * @param {Request} _req
 * @param {Response} res
 * @param {NextFunction} next
 */
export const handleTileRequest = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, z, x, y } = res.locals.tile as ParsedTileRequest;
    const claims = res.locals.tokenClaims;

    const cacheKey = buildCacheKey(claims.ctx, source, z, x, y);

    const { tile, hit } = await resolveTile(cacheKey, async () => {
      // The upstream URL is built entirely from validated values plus the trusted context id from
      // the token. Every client supplied query parameter is discarded: nothing the browser sends can
      // reach Martin or influence the SQL that generates the tile.
      const upstreamPath = `/${source}/${z}/${x}/${y}?context=${encodeURIComponent(claims.ctx)}`;

      const response = await fetchTile(upstreamPath);

      if (response.status >= 500) {
        recordUpstreamError();
        defaultLog.error({ message: 'Martin returned an error', status: response.status, jti: claims.jti });
      }

      recordCacheMiss(response.durationMs);

      return {
        status: response.status,
        headers: response.headers,
        body: response.body
      } satisfies CachedTile;
    });

    if (hit) {
      recordCacheHit();
    }

    // Upstream failures are normalized so no internal or database detail reaches the browser.
    if (tile.status >= 500) {
      throw badGateway();
    }

    if (tile.status === 404) {
      throw notFound('Tile not found');
    }

    // Preserve Martin's response metadata verbatim, including Content-Encoding: the body is still
    // gzipped exactly as Martin produced it and is never decompressed or re-compressed here.
    for (const [header, value] of Object.entries(tile.headers)) {
      res.setHeader(header, value);
    }

    res.setHeader('X-Martin-Cache', hit ? 'HIT' : 'MISS');

    // Tiles are per-user authorized content. Force a private cache so shared or intermediary caches
    // (CDN, proxy) never store one user's authorized tiles and serve them to another. The max-age
    // matches the gateway cache TTL, which also bounds how long a revoked feature lingers in a tile.
    res.setHeader('Cache-Control', `private, max-age=${config.cacheTtlSeconds}`);

    // An empty tile is a legitimate, cacheable answer: the area simply holds no features.
    if (tile.status === 204 || !tile.body.length) {
      // A 204 must not carry a body or a content length.
      res.removeHeader('content-encoding');
      res.status(204).end();
      return;
    }

    res.status(200).end(tile.body);
  } catch (error) {
    next(error);
  }
};

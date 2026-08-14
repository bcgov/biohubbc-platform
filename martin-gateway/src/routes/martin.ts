import { NextFunction, Request, Response } from 'express';
import { verifyMartinToken } from '../auth/verify-token.js';
import { config } from '../config.js';
import { badGateway, forbidden, notFound } from '../errors/tile-error.js';
import { recordRequest, recordUpstreamError, recordUpstreamFetch } from '../metrics.js';
import { loadTileCoalesced, UpstreamTile } from '../upstream/inflight.js';
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
 * @return {void}
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
 * @return {void}
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
 * Serve the tile, collapsing concurrent identical fetches into one upstream request.
 *
 * Rendered tiles are cached by Martin, whose keys include the trusted query string built below, so
 * cached entries are already partitioned per authorization context.
 *
 * @param {Request} _req
 * @param {Response} res
 * @param {NextFunction} next
 * @return {*}  {Promise<void>}
 */
export const handleTileRequest = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { source, z, x, y } = res.locals.tile as ParsedTileRequest;
    const claims = res.locals.tokenClaims;

    // The upstream URL is built entirely from validated values plus the trusted context id from
    // the token. Every client supplied query parameter is discarded: nothing the browser sends can
    // reach Martin or influence the SQL that generates the tile. The version parameter is inert to
    // the tile function but part of Martin's cache key, so bumping it at deploy time invalidates
    // every tile Martin has cached.
    const upstreamPath = `/${source}/${z}/${x}/${y}?context=${encodeURIComponent(claims.ctx)}&v=${encodeURIComponent(
      config.sourceVersion
    )}`;

    recordRequest();

    const tile = await loadTileCoalesced(upstreamPath, async () => {
      const response = await fetchTile(upstreamPath);

      // Only 200 (a tile) and 204 (a legitimately empty tile) are results; 404 means the source is
      // unknown to Martin. Anything else — 5xx, redirects, other 4xx — is an upstream fault, logged
      // here so coalesced followers of the same fetch do not multiply the count.
      if (response.status !== 200 && response.status !== 204 && response.status !== 404) {
        recordUpstreamError();
        defaultLog.error({ message: 'Martin returned an error', status: response.status, jti: claims.jti });
      }

      recordUpstreamFetch(response.durationMs);

      return {
        status: response.status,
        headers: response.headers,
        body: response.body
      } satisfies UpstreamTile;
    });

    if (tile.status === 404) {
      throw notFound('Tile not found');
    }

    // Only 200 and 204 are successful tile responses. Everything else is normalized to a bad
    // gateway so no internal or database detail reaches the browser, and so an upstream error page
    // (or an empty-bodied redirect) can never be mistaken for a valid or empty tile.
    if (tile.status !== 200 && tile.status !== 204) {
      throw badGateway();
    }

    // Preserve Martin's response metadata verbatim, including Content-Encoding: the body is still
    // gzipped exactly as Martin produced it and is never decompressed or re-compressed here.
    for (const [header, value] of Object.entries(tile.headers)) {
      res.setHeader(header, value);
    }

    // Tiles are per-user authorized content served on a URL that does not identify the user, so no
    // browser or intermediary may store them: a cached tile could otherwise be replayed to a
    // different principal on the same machine without any request (or token check) taking place.
    // Server-side performance is Martin's cache; in-session panning is MapLibre's in-memory cache.
    res.setHeader('Cache-Control', 'no-store');

    // An empty tile is a legitimate answer: the area simply holds no features.
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

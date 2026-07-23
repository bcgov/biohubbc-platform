/**
 * Error carrying an HTTP status for the client.
 *
 * Messages are deliberately generic. Upstream failures (Martin, PostGIS) must never leak internal
 * service or database detail to the browser; the detail is logged instead.
 */
export class TileError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TileError';
    this.status = status;
  }
}

/** The caller did not present a usable token: missing, malformed, expired, or badly signed. */
export const unauthorized = (message = 'Invalid or expired tile token') => new TileError(401, message);

/** The token is valid but does not grant what was asked for. */
export const forbidden = (message = 'Tile token does not permit this request') => new TileError(403, message);

/** The request did not match the single allowlisted tile route. */
export const notFound = (message = 'Not found') => new TileError(404, message);

/** Martin is unavailable or failed. */
export const badGateway = (message = 'Tile service unavailable') => new TileError(502, message);

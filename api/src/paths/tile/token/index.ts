import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { tileTokenResponseSchema } from '../../../openapi/schemas/tile';
import { tileTokenRateLimiter } from '../../../request-handlers/rate-limit';
import { TileTokenService } from '../../../services/tile-token-service';
import { getLogger } from '../../../utils/logger';
import { getActiveSystemUserId } from '../../../utils/system-user-context';

const defaultLog = getLogger('paths/tile/token');

/** The source tokens are minted against. Replaced by the real search source in SIMSBIOHUB-1103. */
const DEFAULT_TILE_SOURCE = 'fixture';

export const POST: Operation = [tileTokenRateLimiter, createTileSession()];

POST.apiDoc = {
  description: 'Create a vector tile session and issue a short lived tile token.',
  tags: ['tile'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  responses: {
    200: {
      description: 'A tile token and the tile URL template to use with it.',
      content: {
        'application/json': { schema: tileTokenResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a tile session.
 *
 * Identity is resolved exactly as feature search resolves it, so map results can never diverge from
 * table results: anonymous callers get an anonymous connection, authenticated callers get their own,
 * and the resulting system user id is what will select the authorization context.
 *
 * Tile bytes never pass through this API. This endpoint only issues a token; the browser fetches
 * tiles from the tile gateway, which verifies the token locally and proxies to Martin.
 *
 * NOTE: the server side context record is created in SIMSBIOHUB-1103. Until then the context claim
 * is a fixed placeholder and the token is minted against the fixture source. The claim shape is
 * final, so nothing downstream changes when the real context lands.
 *
 * @returns {RequestHandler}
 */
export function createTileSession(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      // Resolved now so the identity path is identical to feature search from the outset. The value
      // is what SIMSBIOHUB-1103 uses to build the authorization context.
      const systemUserId = isAuthenticated ? await getActiveSystemUserId(connection) : null;

      await connection.commit();

      const service = new TileTokenService();

      const { token, expiresIn } = service.mintToken({
        source: DEFAULT_TILE_SOURCE,
        ctx: systemUserId ? 'placeholder-scoped' : 'placeholder-anonymous'
      });

      // The token is short lived and caller specific, so it must never be cached.
      res.setHeader('Cache-Control', 'no-store');

      return res.status(200).json({
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        source: DEFAULT_TILE_SOURCE,
        tile_url_template: service.getTileUrlTemplate(DEFAULT_TILE_SOURCE)
      });
    } catch (error) {
      defaultLog.error({ label: 'createTileSession', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

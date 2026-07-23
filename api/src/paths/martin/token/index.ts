import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { martinTokenResponseSchema } from '../../../openapi/schemas/martin';
import { martinTokenRateLimiter } from '../../../request-handlers/rate-limit';
import { MartinTokenService } from '../../../services/martin-token-service';
import { getLogger } from '../../../utils/logger';
import { getActiveSystemUserId } from '../../../utils/system-user-context';

const defaultLog = getLogger('paths/martin/token');

/**
 * The source tokens are minted against. Must match the gateway's allowlist (`MARTIN_ALLOWED_SOURCES`),
 * which the gateway checks the `source` claim against before proxying. Martin does not publish this
 * source until SIMSBIOHUB-1103, so an authorized request reaches Martin and returns 404 until then.
 */
const DEFAULT_MARTIN_SOURCE = 'search';

export const POST: Operation = [martinTokenRateLimiter, createMartinSession()];

POST.apiDoc = {
  description: 'Create a vector Martin session and issue a short lived tile token.',
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
        'application/json': { schema: martinTokenResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a Martin session.
 *
 * Identity is resolved exactly as feature search resolves it, so map results can never diverge from
 * table results: anonymous callers get an anonymous connection, authenticated callers get their own,
 * and the resulting system user id is what will select the authorization context.
 *
 * Tile bytes never pass through this API. This endpoint only issues a token; the browser fetches
 * tiles from the Martin Gateway, which verifies the token locally and proxies to Martin.
 *
 * NOTE: the server side context record is created in SIMSBIOHUB-1103, which is also where Martin
 * begins publishing the `search` source. Until then the context claim is a fixed placeholder, and an
 * authorized tile request reaches Martin only to find no such source (404). The claim shape is final,
 * so nothing downstream changes when the real context lands.
 *
 * @returns {RequestHandler}
 */
export function createMartinSession(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      // Resolved now so the identity path is identical to feature search from the outset. The value
      // is what SIMSBIOHUB-1103 uses to build the authorization context.
      const systemUserId = isAuthenticated ? await getActiveSystemUserId(connection) : null;

      await connection.commit();

      const service = new MartinTokenService();

      const { token, expiresIn } = service.mintToken({
        source: DEFAULT_MARTIN_SOURCE,
        ctx: systemUserId ? 'placeholder-scoped' : 'placeholder-anonymous'
      });

      // The token is short lived and caller specific, so it must never be cached.
      res.setHeader('Cache-Control', 'no-store');

      return res.status(200).json({
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        source: DEFAULT_MARTIN_SOURCE,
        martin_url_template: service.getMartinUrlTemplate(DEFAULT_MARTIN_SOURCE)
      });
    } catch (error) {
      defaultLog.error({ label: 'createMartinSession', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

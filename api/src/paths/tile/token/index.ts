import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { ExpressionTree } from '../../../models/expression-tree';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { tileSessionRequestBodySchema, tileSessionResponseSchema } from '../../../openapi/schemas/tile';
import { tileTokenRateLimiter } from '../../../request-handlers/rate-limit';
import { TileContextService } from '../../../services/tile-context-service';
import { TileTokenService } from '../../../services/tile-token-service';
import { getLogger } from '../../../utils/logger';
import { getActiveSystemUserId } from '../../../utils/system-user-context';

const defaultLog = getLogger('paths/tile/token');

/** Martin source serving authorized search-result tiles. */
const TILE_SOURCE = 'search';

export const POST: Operation = [tileTokenRateLimiter, createTileSession()];

POST.apiDoc = {
  description: 'Create a vector tile session for a search, and issue a short lived tile token.',
  tags: ['tile'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  requestBody: tileSessionRequestBodySchema,
  responses: {
    200: {
      description: 'A tile session, or a refusal if the search matched more features than can be mapped.',
      content: {
        'application/json': { schema: tileSessionResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a tile session.
 *
 * Identity is resolved exactly as feature search resolves it, and the authorized result set is
 * derived by the same expression evaluator, so the map can never show something the table view would
 * hide, or the reverse.
 *
 * The token the browser receives carries only an opaque context id. The access class, the resolved
 * security scopes and the matching feature ids all stay server-side, and the tile function re-applies
 * the security predicate every time it generates a tile. A client therefore cannot widen its own
 * access by editing the token, and securing a feature removes it from tiles within one gateway cache
 * TTL rather than lasting for the life of the session.
 *
 * Tile bytes never pass through this API: the browser fetches tiles from the tile gateway.
 *
 * @returns {RequestHandler}
 */
export function createTileSession(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = isAuthenticated ? await getActiveSystemUserId(connection) : null;
      const featureType = req.body.feature_type?.trim().toLowerCase();

      if (!featureType) {
        throw new HTTP400('Feature type is required');
      }

      // Validated the way the search endpoint validates it, so an expression the table view accepts
      // is never rejected here, or the reverse.
      const expressionTreeParseResult = req.body.expression ? ExpressionTree.safeParse(req.body.expression) : null;

      if (expressionTreeParseResult?.success === false) {
        throw new HTTP400('Invalid expression tree', expressionTreeParseResult.error.issues);
      }

      const service = new TileContextService(connection);

      const context = await service.createOrReuseTileContext(
        featureType,
        expressionTreeParseResult?.data,
        systemUserId
      );

      await connection.commit();

      // The token is short lived and caller specific, so it must never be cached.
      res.setHeader('Cache-Control', 'no-store');

      if (context.overCap) {
        // No token issued: a partially mapped result set would be a spatially biased view of the
        // search, which is more misleading than declining to map it.
        return res.status(200).json({ over_cap: true, cap: context.cap });
      }

      const tokenService = new TileTokenService();

      const { token, expiresIn } = tokenService.mintToken({
        source: TILE_SOURCE,
        ctx: context.tileContextId
      });

      return res.status(200).json({
        over_cap: false,
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        context_expires_in: context.expiresInSeconds,
        source: TILE_SOURCE,
        tile_url_template: tokenService.getTileUrlTemplate(TILE_SOURCE),
        bbox: context.boundingBox,
        feature_count: context.featureCount,
        has_more_secured_features: context.hasMoreSecuredFeatures
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

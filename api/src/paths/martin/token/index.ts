import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { MARTIN_SOURCE } from '../../../constants/martin';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { ExpressionTree } from '../../../models/expression-tree';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { martinSessionRequestBodySchema, martinSessionResponseSchema } from '../../../openapi/schemas/martin';
import { martinTokenRateLimiter } from '../../../request-handlers/rate-limit';
import { MartinContextService } from '../../../services/martin-context-service';
import { MartinTokenService } from '../../../services/martin-token-service';
import { getLogger } from '../../../utils/logger';
import { getActiveSystemUserId } from '../../../utils/system-user-context';

const defaultLog = getLogger('paths/martin/token');

export const POST: Operation = [martinTokenRateLimiter, createMartinSession()];

POST.apiDoc = {
  description: 'Create a vector Martin session for a search, and issue a short lived tile token.',
  tags: ['tile'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  requestBody: martinSessionRequestBodySchema,
  responses: {
    200: {
      description: 'A Martin session, or a refusal if the search matched more features than can be mapped.',
      content: {
        'application/json': { schema: martinSessionResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a Martin session.
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
 * Tile bytes never pass through this API: the browser fetches tiles from the Martin Gateway.
 *
 * @returns {RequestHandler}
 */
export function createMartinSession(): RequestHandler {
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

      const service = new MartinContextService(connection);

      const context = await service.createOrReuseMartinContext(
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

      const tokenService = new MartinTokenService();

      const { token, expiresIn } = tokenService.mintToken({
        source: MARTIN_SOURCE.SEARCH,
        ctx: context.martinContextId
      });

      return res.status(200).json({
        over_cap: false,
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        context_expires_in: context.expiresInSeconds,
        source: MARTIN_SOURCE.SEARCH,
        martin_url_template: tokenService.getMartinUrlTemplate(MARTIN_SOURCE.SEARCH),
        bbox: context.boundingBox,
        feature_count: context.featureCount,
        has_more_secured_features: context.hasMoreSecuredFeatures
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

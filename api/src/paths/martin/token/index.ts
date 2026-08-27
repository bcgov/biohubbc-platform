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
      description: 'A Martin session.',
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
 * Identity is resolved exactly as feature search resolves it, and the search expression is persisted
 * through the same normalization the search endpoint applies, so the map can never show something
 * the table view would hide, or the reverse.
 *
 * The token the browser receives carries only an opaque context id. The persisted expression and the
 * caller's identity stay server-side, and the tile function evaluates both — including live team
 * membership — every time a tile is generated. A client therefore cannot widen its own access by
 * editing the token, and securing a feature (or revoking a membership) affects tiles within one
 * Martin cache expiry rather than lasting for the life of the session. A search of any size can be
 * mapped: what is stored is the search, not its results.
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

      const tokenService = new MartinTokenService();

      const { token, expiresIn } = tokenService.mintToken({
        source: MARTIN_SOURCE.SEARCH,
        ctx: context.martinContextId
      });

      return res.status(200).json({
        token,
        token_type: 'Bearer',
        token_expires_in: expiresIn,
        context_expires_in: context.expiresInSeconds,
        source: MARTIN_SOURCE.SEARCH,
        martin_context_id: context.martinContextId,
        martin_url_template: tokenService.getMartinUrlTemplate(MARTIN_SOURCE.SEARCH),
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

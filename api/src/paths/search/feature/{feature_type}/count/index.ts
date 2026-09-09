import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import {
  featureSearchCountRequestBodySchema,
  featureSearchCountResponseSchema
} from '../../../../../openapi/schemas/search/search-feature';
import { SearchFeatureService } from '../../../../../services/search-feature-service';
import { getLogger } from '../../../../../utils/logger';
import { registerRequestCancellation } from '../../../../../utils/request-cancellation';
import {
  validateSearchExpressionTree,
  validateSearchFeatureType
} from '../../../../../utils/search-feature-validation';
import { getActiveSystemUserId } from '../../../../../utils/system-user-context';

const defaultLog = getLogger('paths/search/feature/{feature_type}/count');

export const POST: Operation = [countFeatures()];

POST.apiDoc = {
  description: 'Count the features matching an expression tree.',
  tags: ['search'],
  security: [{ OptionalBearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'feature_type',
      required: true,
      schema: { type: 'string' }
    }
  ],
  requestBody: featureSearchCountRequestBodySchema,
  responses: {
    200: {
      description: 'Matching feature count',
      content: { 'application/json': { schema: featureSearchCountResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Count the features matching an optional expression tree.
 *
 * @returns {RequestHandler}
 */
export function countFeatures(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const cancellation = registerRequestCancellation(res);
    const connectionOptions = { signal: cancellation.signal };
    const connection = isAuthenticated
      ? getDBConnection(req.keycloak_token, connectionOptions)
      : getAPIUserDBConnection(connectionOptions);

    try {
      await connection.open();

      const systemUserId = isAuthenticated ? await getActiveSystemUserId(connection) : null;
      const featureType = validateSearchFeatureType(req.params.feature_type);
      const expressionTree = validateSearchExpressionTree(req.body.expression);
      const total = await new SearchFeatureService(connection).countSearchFeaturesByExpressionTree(
        featureType,
        expressionTree,
        systemUserId
      );

      await connection.commit();
      return res.status(200).json({ total });
    } catch (error) {
      defaultLog.error({ label: 'countFeatures', message: 'error', error });
      cancellation.unregister();
      await connection.rollback();
      throw error;
    } finally {
      cancellation.unregister();
      await connection.release();
    }
  };
}

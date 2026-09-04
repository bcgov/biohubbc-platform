import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  featureSearchRequestBodySchema,
  featureSearchResponseSchema
} from '../../../../openapi/schemas/search/search-feature';
import { SearchFeatureService } from '../../../../services/search-feature-service';
import { getLogger } from '../../../../utils/logger';
import { makeCursorPaginationOptionsFromBody } from '../../../../utils/pagination';
import { registerRequestCancellation } from '../../../../utils/request-cancellation';
import { validateSearchExpressionTree, validateSearchFeatureType } from '../../../../utils/search-feature-validation';
import { getActiveSystemUserId } from '../../../../utils/system-user-context';

const defaultLog = getLogger('paths/search/feature/{feature_type}');

export const POST: Operation = [searchFeatures()];

POST.apiDoc = {
  description: 'Search for features by expression tree.',
  tags: ['search'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'feature_type',
      required: true,
      schema: {
        type: 'string'
      }
    }
  ],
  requestBody: featureSearchRequestBodySchema,
  responses: {
    200: {
      description: 'Search results sorted by relevancy',
      content: {
        'application/json': { schema: featureSearchResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Search for features of a target feature type using an expression tree.
 *
 * @returns {RequestHandler}
 */
export function searchFeatures(): RequestHandler {
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
      const cursorPagination = makeCursorPaginationOptionsFromBody(req);
      const service = new SearchFeatureService(connection);
      const expressionTree = validateSearchExpressionTree(req.body.expression);

      const {
        features,
        properties,
        has_more_secured_features,
        pagination: paginationCursors
      } = await service.searchFeaturesByExpressionTreeWithMetadata(
        featureType,
        expressionTree,
        cursorPagination,
        systemUserId
      );

      await connection.commit();

      return res.status(200).json({
        features,
        properties,
        has_more_secured_features,
        pagination: paginationCursors
      });
    } catch (error) {
      defaultLog.error({ label: 'searchFeatures', message: 'error', error });
      cancellation.unregister();
      await connection.rollback();
      throw error;
    } finally {
      cancellation.unregister();
      await connection.release();
    }
  };
}

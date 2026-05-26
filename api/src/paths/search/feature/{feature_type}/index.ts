import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { ExpressionTree } from '../../../../models/expression-tree';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  featureSearchRequestBodySchema,
  featureSearchResponseSchema
} from '../../../../openapi/schemas/search/search-feature';
import { SearchFeatureService } from '../../../../services/search-feature-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromBody, makePaginationResponse } from '../../../../utils/pagination';

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
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const systemUserId = isAuthenticated ? connection.systemUserId() : null;
      const featureType = req.params.feature_type?.trim().toLowerCase();
      const pagination = makePaginationOptionsFromBody(req);
      const service = new SearchFeatureService(connection);

      if (!featureType) {
        throw new HTTP400('Feature type path parameter is required');
      }

      const expressionTreeParseResult = req.body.expression ? ExpressionTree.safeParse(req.body.expression) : null;

      if (expressionTreeParseResult?.success === false) {
        throw new HTTP400('Invalid expression tree', expressionTreeParseResult.error.issues);
      }

      const expressionTree = expressionTreeParseResult?.data;

      const { features, count } = await service.searchFeaturesByExpressionTreeWithCount(
        featureType,
        expressionTree,
        pagination,
        systemUserId
      );

      await connection.commit();

      res.setHeader('Cache-Control', 'public, max-age=90');

      return res.status(200).json({ features: features, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'searchFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

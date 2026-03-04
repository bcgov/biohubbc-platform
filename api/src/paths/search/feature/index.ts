import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import {
  featureSearchRequestBodySchema,
  featureSearchResponseSchema
} from '../../../openapi/schemas/search/search-feature';
import { SearchFeatureService } from '../../../services/search-feature-service';
import { ISearchFeaturesFilters } from '../../../services/search-feature-service.interface';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromBody, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/search/feature');

export const POST: Operation = [searchFeatures()];

POST.apiDoc = {
  description: 'Search for features by keyword and optional filters.',
  tags: ['search'],
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
 * Search for features by keywords and/or property filters.
 *
 * @returns {RequestHandler}
 */
export function searchFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const filters = req.body.filters as ISearchFeaturesFilters;

      const service = new SearchFeatureService(connection);

      const pagination = makePaginationOptionsFromBody(req);

      const [features, count] = await Promise.all([
        service.searchFeatures(filters, pagination),
        service.getSearchFeaturesCount(filters)
      ]);
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import {
  propertySearchRequestBodySchema,
  propertySearchResponseSchema
} from '../../../openapi/schemas/search/search-property';
import { PropertySearchService } from '../../../services/property-search-service';
import { ISearchPropertyFilters } from '../../../services/property-search-service.interface';
import { getLogger } from '../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromBody,
  makePaginationResponse
} from '../../../utils/pagination';

const defaultLog = getLogger('paths/search/property');

export const POST: Operation = [searchProperties()];

POST.apiDoc = {
  description: 'Search for properties by keyword and optional filters.',
  tags: ['search'],
  requestBody: propertySearchRequestBodySchema,
  responses: {
    200: {
      description: 'Search results sorted by relevancy',
      content: {
        'application/json': { schema: propertySearchResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Search for properties by keywords and/or property filters.
 *
 * @returns {RequestHandler}
 */
export function searchProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const filters = req.body.filters as ISearchPropertyFilters;

      const service = new PropertySearchService(connection);

      const pagination = makePaginationOptionsFromBody(req);

      const [properties, count] = await Promise.all([
        service.searchProperty(filters, ensureCompletePaginationOptions(pagination)),
        service.getSearchPropertyCount(filters)
      ]);
      await connection.commit();

      res.setHeader('Cache-Control', 'public, max-age=90');

      return res.status(200).json({ properties: properties, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'searchProperties', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

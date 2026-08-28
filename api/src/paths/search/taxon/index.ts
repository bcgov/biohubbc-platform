import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { taxonSearchRequestBodySchema, taxonSearchResponseSchema } from '../../../openapi/schemas/search/search-taxon';
import { SearchService } from '../../../services/search-service';
import { SearchTaxonFilters } from '../../../services/search-service.interface';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromBody, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/search/taxon');

export const POST: Operation = [searchTaxon()];

POST.apiDoc = {
  description: 'Search local taxon records by filter.',
  tags: ['search'],
  requestBody: taxonSearchRequestBodySchema,
  responses: {
    200: {
      description: 'Paginated local taxon search results.',
      content: {
        'application/json': { schema: taxonSearchResponseSchema }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Search for local taxon records by filter.
 *
 * @returns {RequestHandler}
 */
export function searchTaxon(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const filters = req.body.filters as SearchTaxonFilters;
      const pagination = makePaginationOptionsFromBody(req);
      const service = new SearchService(connection);
      const taxonomy = await service.findTaxon(filters, pagination);

      await connection.commit();

      res.setHeader('Cache-Control', 'public, max-age=90');

      return res.status(200).json({
        taxonomy: taxonomy.data,
        pagination: makePaginationResponse(taxonomy.total, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'searchTaxon', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

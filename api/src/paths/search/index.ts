import { Request, RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../openapi/schemas/pagination';
import { searchAllResponseSchema } from '../../openapi/schemas/search/search-all';
import { SearchService } from '../../services/search-service';
import { SearchParams } from '../../services/search-service.interface';
import { getLogger } from '../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../utils/pagination';

const defaultLog = getLogger('paths/search/index');

export const GET: Operation = [searchAll()];

GET.apiDoc = {
  description: 'Search features, submissions, and taxonomy.',
  tags: ['search'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'keyword',
      schema: { type: 'string' },
      description: 'Free-text keyword search across all searchable properties'
    },
    {
      in: 'query',
      name: 'feature_type_name',
      schema: { type: 'string' },
      description: 'Filter results to a specific feature type'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated search results for features, submissions, and taxonomy.',
      content: {
        'application/json': {
          schema: searchAllResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Handler for searching features, submissions, and taxonomy.
 */
export function searchAll(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    try {
      await connection.open();

      const searchService = new SearchService(connection);

      const filters = parseQueryParams(req);
      const paginationOptions = makePaginationOptionsFromRequest(req);

      const result = await searchService.search(filters, paginationOptions);

      await connection.commit();

      res.setHeader('Cache-Control', 'public, max-age=90');

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'searchAll', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Parse query parameters from the request.
 *
 * @param req Express request object with query parameters
 * @returns Keyword for search
 */
export function parseQueryParams(req: Request<unknown, unknown, unknown, Partial<SearchParams>>): SearchParams {
  return { keyword: req.query.keyword ?? '', feature_type_name: req.query.feature_type_name ?? undefined };
}

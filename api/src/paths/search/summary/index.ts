import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SearchService } from '../../../services/search-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/search/summary/index');

export const GET: Operation = [searchSummary()];

GET.apiDoc = {
  description: 'Get a summary count of features, submissions, and taxa for a search term.',
  tags: ['search'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'search',
      schema: { type: 'string' },
      required: true,
      description: 'Search term to match features, submissions, and taxa.'
    }
  ],
  responses: {
    200: {
      description: 'Summary counts for features, submissions, and taxa.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              features: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    feature_type_name: { type: 'string' },
                    total: { type: 'integer', minimum: 0 }
                  },
                  required: ['feature_type_name', 'total']
                }
              },
              submissions: {
                type: 'object',
                properties: {
                  total: { type: 'integer', minimum: 0 }
                },
                required: ['total']
              },
              taxonomy: {
                type: 'object',
                properties: {
                  total: { type: 'integer', minimum: 0 }
                },
                required: ['total']
              }
            },
            required: ['features', 'submissions', 'taxonomy']
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Returns summary of search results matching the search criteria
 *
 * @returns {RequestHandler}
 */
export function searchSummary(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const searchService = new SearchService(connection);

      const searchTerm = req.query.search as string;

      const summary = await searchService.getSearchSummary({ search: searchTerm });

      await connection.commit();

      res.setHeader('Cache-Control', 'public, max-age=90');

      res.status(200).json(summary);
    } catch (error) {
      defaultLog.error({ label: 'searchSummary', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

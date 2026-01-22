import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { SearchService } from '../../services/search-service';
import { getLogger } from '../../utils/logger';
import { ApiPaginationOptions } from '../../zod-schema/pagination';

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
      name: 'search',
      schema: { type: 'string' },
      required: true,
      description: 'Search term to match features, submissions, and taxa.'
    },
    {
      in: 'query',
      name: 'page',
      schema: { type: 'integer', minimum: 1 },
      required: false,
      description: 'Page number for pagination.'
    },
    {
      in: 'query',
      name: 'limit',
      schema: { type: 'integer', minimum: 1 },
      required: false,
      description: 'Number of items per page.'
    }
  ],
  responses: {
    200: {
      description: 'Paginated search results for features, submissions, and taxonomy.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              features: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        submission_feature_id: { type: 'integer' },
                        feature_type_id: { type: 'integer' },
                        label: { type: 'string' }
                      },
                      required: ['submission_feature_id', 'feature_type_id', 'label']
                    }
                  },
                  total: { type: 'integer' }
                },
                required: ['data', 'total']
              },
              submissions: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        submission_id: { type: 'integer' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true }
                      },
                      required: ['submission_id', 'name']
                    }
                  },
                  total: { type: 'integer' }
                },
                required: ['data', 'total']
              },
              taxonomy: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        taxon_id: { type: 'integer' },
                        itis_scientific_name: { type: 'string' }
                      },
                      required: ['taxon_id', 'itis_scientific_name']
                    }
                  },
                  total: { type: 'integer' }
                },
                required: ['data', 'total']
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
 * Handler for searching features, submissions, and taxonomy.
 */
export function searchAll(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const searchService = new SearchService(connection);

      // Extract search params from query
      const searchTerm = req.query.search as string;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const pagination: ApiPaginationOptions | undefined = page && limit ? { page, limit } : undefined;

      const result = await searchService.search({ search: searchTerm }, pagination);

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

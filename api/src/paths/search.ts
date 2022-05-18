import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { ElasticSearchService } from '../services/es';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('paths/taxonomy/search');

export const GET: Operation = [searchInElasticSearch()];

GET.apiDoc = {
  description: 'Gets a list of taxonomic units.',
  tags: ['taxonomy'],
  parameters: [
    {
      description: 'Generic search parameters.',
      in: 'query',
      name: 'terms',
      required: true,
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'Taxonomy search response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              searchResponse: {
                type: 'array',
                items: {
                  title: 'Search items',
                  type: 'object',
                  required: ['id', 'label'],
                  properties: {
                    id: {
                      type: 'string'
                    },
                    label: {
                      type: 'string'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Get taxonomic search results.
 *
 * @returns {RequestHandler}
 */
export function searchInElasticSearch(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getSearchResults', message: 'request params', req_params: req.query.terms });

    const term = String(req.query.terms) || '';
    const indexName = String(req.query.index) || '';
    try {
      const elasticSearch = new ElasticSearchService();
      const response = await elasticSearch.searchItems(term.toLowerCase(), indexName.toLowerCase());

      res.status(200).json({ searchResponse: response });
    } catch (error) {
      defaultLog.error({ label: 'getSearchResults', message: 'error', error });
      throw error;
    }
  };
}

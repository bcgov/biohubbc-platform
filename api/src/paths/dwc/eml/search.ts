import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ESService } from '../../../services/es-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  searchInElasticSearch()
];

GET.apiDoc = {
  description: 'searches submission files with elastic search',
  tags: ['search'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'submission search parameters.',
      in: 'query',
      name: 'terms',
      required: false,
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'Submission search response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id'],
              nullable: true,
              properties: {
                id: {
                  type: 'string'
                },
                source: {
                  type: 'object',
                  properties: {
                    datasetName: {
                      type: 'string'
                    },
                    publishDate: {
                      type: 'string'
                    },
                    projects: {
                      type: 'array',
                      items: {
                        type: 'object'
                      }
                    }
                  }
                },
                fields: {
                  type: 'object'
                }
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Search for meta data in Elastic Search.
 *
 * @returns {RequestHandler}
 */
export function searchInElasticSearch(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({
      label: 'getSearchResults',
      message: 'request params',
      terms: req.query.terms,
      index: req.query.index
    });

    const indexName = String(req.query.index) || '';

    try {
      const elasticSearch = await new ESService();

      const response = await elasticSearch.search<{ datasetTitle: string[] }>(indexName, ['datasetTitle']);

      const result = response
        ? response.map((item) => {
            return {
              id: item._id,
              fields: item.fields,
              source: item._source
            };
          })
        : [];

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSearchResults', message: 'error', error });
      throw error;
    }
  };
}

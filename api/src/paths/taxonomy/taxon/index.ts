import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { ItisService } from '../../../services/itis-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/taxonomy/taxon');

export const GET: Operation = [findTaxonBySearchTerms()];

GET.apiDoc = {
  description: 'Find taxon records by search criteria.',
  tags: ['taxonomy'],
  security: [],
  parameters: [
    {
      description: 'Taxonomy search terms.',
      in: 'query',
      name: 'terms',
      required: true,
      schema: {
        type: 'array',
        description: 'One or more search terms.',
        items: {
          type: 'string',
          minLength: 1
        },
        minItems: 1
      }
    }
  ],
  responses: {
    200: {
      description: 'Taxonomy response.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              searchResponse: {
                type: 'array',
                items: {
                  title: 'Taxon',
                  type: 'object',
                  required: ['tsn', 'commonNames', 'scientificName'],
                  properties: {
                    tsn: {
                      type: 'integer'
                    },
                    commonNames: {
                      type: 'array',
                      items: {
                        type: 'string'
                      }
                    },
                    scientificName: {
                      type: 'string'
                    },
                    rank: {
                      type: 'string'
                    },
                    kingdom: {
                      type: 'string'
                    }
                  },
                  additionalProperties: false
                }
              }
            },
            additionalProperties: false
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
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
 * Get taxon by search terms.
 *
 * @returns {RequestHandler}
 */
export function findTaxonBySearchTerms(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'findTaxonBySearchTerms', message: 'query params', query: req.query });

    const searchTerms = req.query.terms as string[];

    try {
      const itisService = new ItisService();

      const response = await itisService.searchItisByTerm(searchTerms);

      // Overwrite default cache-control header, allow caching up to 7 days
      res.setHeader('Cache-Control', 'max-age=604800');

      res.status(200).json({ searchResponse: response });
    } catch (error) {
      defaultLog.error({ label: 'findTaxonBySearchTerms', message: 'error', error });
      throw error;
    }
  };
}

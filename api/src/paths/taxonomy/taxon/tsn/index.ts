import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { TaxonomyService } from '../../../../services/taxonomy-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/taxonomy/taxon/tsn');

export const GET: Operation = [getTaxonByTSN()];

GET.apiDoc = {
  description: 'Get taxon records by TSN ids.',
  tags: ['taxonomy'],
  security: [],
  parameters: [
    {
      description: 'Taxon TSN ids.',
      in: 'query',
      name: 'tsn',
      schema: {
        type: 'array',
        description: 'One or more Taxon TSN ids.',
        items: {
          type: 'integer',
          minimum: 0,
          minItems: 1,
          maxItems: 100
        }
      },
      required: true
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
                  title: 'Species',
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
 * Get taxon by ITIS TSN.
 *
 * @returns {RequestHandler}
 */
export function getTaxonByTSN(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getTaxonByTSN', message: 'query params', query: req.query });

    const connection = getAPIUserDBConnection();

    const tsnIds: number[] = (req.query.tsn as (string | number)[]).map(Number);

    try {
      await connection.open();

      const taxonomyService = new TaxonomyService(connection);

      const response = await taxonomyService.getTaxonByTsnIds(tsnIds);

      connection.commit();

      // Overwrite default cache-control header, allow caching up to 7 days
      res.setHeader('Cache-Control', 'max-age=604800');

      res.status(200).json({ searchResponse: response });
    } catch (error) {
      defaultLog.error({ label: 'getTaxonByTSN', message: 'error', error });
      connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

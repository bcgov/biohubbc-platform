import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { TaxonomyService } from '../../../../services/taxonomy-service';
import { getServiceClientSystemUser } from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/taxonomy/taxon/{tsn}');

export const GET: Operation = [getTaxonByTSN()];

GET.apiDoc = {
  description: 'Get taxon records by TSN ids.',
  tags: ['taxonomy'],
  security: [
    {
      Bearer: []
    }
  ],
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
                  required: ['tsn', 'label'],
                  properties: {
                    tsn: {
                      type: 'string'
                    },
                    label: {
                      type: 'string'
                    },
                    scientificName: {
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

    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a sub or sub value is unknown'
      ]);
    }

    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

    const tsnIds: number[] = (req.query.tsn as string[]).map(Number);

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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { ItisService } from '../../../../services/itis-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/taxonomy/taxon/tsn/hierarchy');

export const GET: Operation = [getTaxonHierarchyByTSN()];

GET.apiDoc = {
  description: 'Get taxon records by TSN ids.',
  tags: ['taxon_id'],
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
            type: 'array',
            items: {
              title: 'Species',
              type: 'object',
              required: ['tsn', 'hierarchy'],
              properties: {
                tsn: {
                  type: 'integer'
                },
                hierarchy: { type: 'array', items: { type: 'integer' } }
              },
              additionalProperties: false
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
export function getTaxonHierarchyByTSN(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getTaxonHierarchyByTSN', message: 'query params', query: req.query });

    const connection = getAPIUserDBConnection();

    const tsnIds: number[] = (req.query.tsn as (string | number)[]).map(Number);

    try {
      await connection.open();

      const itisService = new ItisService();

      const response = await itisService.getHierarchyForTSNs(tsnIds);

      connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getTaxonHierarchyByTSN', message: 'error', error });
      connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

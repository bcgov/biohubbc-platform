import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { SecurityService } from '../../../services/security-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/security/persecution-harm/list');

export const GET: Operation = [getPersecutionAndHarmRules()];

GET.apiDoc = {
  description: 'Gets all latest persecution and harm rules.',
  tags: ['security'],
  parameters: [],
  responses: {
    200: {
      description: 'Security search response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'Persecution and Harm Rule',
              type: 'object',
              required: [
                'persecution_or_harm_id',
                'persecution_or_harm_type_id',
                'wldtaxonomic_units_id',
                'name',
                'description'
              ],
              properties: {
                persecution_or_harm_id: {
                  type: 'integer',
                  minimum: 1
                },
                persecution_or_harm_type_id: {
                  type: 'integer',
                  minimum: 1
                },
                wldtaxonomic_units_id: {
                  type: 'integer',
                  minimum: 1
                },
                name: {
                  type: 'string'
                },
                description: {
                  type: 'string'
                }
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
export function getPersecutionAndHarmRules(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'getPersecutionAndHarmRules', message: 'request body', req_body: req.query });
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();

      const securityService = new SecurityService(connection);
      const response = await securityService.getPersecutionAndHarmRules();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getSearchResults', message: 'error', error });
      throw error;
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SecurityService } from '../../../services/security-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/rules');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getActiveSecurityRules()
];

GET.apiDoc = {
  description:
    'Get all active security rules, with their respective categories. A security rule is active if it has not been end-dated.',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'Security rules with category.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              required: [
                'security_rule_id',
                'name',
                'description',
                'record_effective_date',
                'record_end_date',
                'security_category_id',
                'category_name',
                'category_description',
                'category_record_effective_date',
                'category_record_end_date'
              ],
              properties: {
                security_rule_id: {
                  type: 'integer'
                },
                name: {
                  type: 'string'
                },
                description: {
                  type: 'string'
                },
                record_effective_date: {
                  type: 'string'
                },
                record_end_date: {
                  type: 'string',
                  nullable: true
                },
                security_category_id: {
                  type: 'integer',
                  minimum: 1
                },
                category_name: {
                  type: 'string'
                },
                category_description: {
                  type: 'string'
                },
                category_record_effective_date: {
                  type: 'string'
                },
                category_record_end_date: {
                  type: 'string',
                  nullable: true
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
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/403'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

export function getActiveSecurityRules(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const service = new SecurityService(connection);

    try {
      await connection.open();

      const data = await service.getActiveRulesAndCategories();

      await connection.commit();

      return res.status(200).json(data);
    } catch (error) {
      defaultLog.error({ label: 'getActiveSecurityRules', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

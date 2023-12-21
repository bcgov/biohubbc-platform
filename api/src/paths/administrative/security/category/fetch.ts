import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../services/security-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/category');

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
  getActiveSecurityCategories()
];

GET.apiDoc = {
  description: 'Get all active security categories.',
  tags: ['security'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'Security Categories.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                security_rule_id: {
                  type: 'number'
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
                  type: 'number'
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

export function getActiveSecurityCategories(): RequestHandler {
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SecurityService } from '../../../services/security-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/categories');

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
  description:
    'Get all active security rules with their associated categories. A security category is active if it has not been end-dated.',
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
              required: [
                'security_category_id',
                'name',
                'description',
                'record_effective_date',
                'record_end_date',
                'create_date',
                'create_user',
                'update_date',
                'update_user',
                'revision_count'
              ],
              properties: {
                security_category_id: {
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
                create_date: {
                  type: 'string'
                },
                create_user: {
                  type: 'integer'
                },
                update_date: {
                  type: 'string',
                  nullable: true
                },
                update_user: {
                  type: 'integer',
                  minimum: 1,
                  nullable: true
                },
                revision_count: {
                  type: 'integer'
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

export function getActiveSecurityCategories(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const service = new SecurityService(connection);

    try {
      await connection.open();

      const data = await service.getActiveSecurityCategories();

      await connection.commit();

      return res.status(200).json(data);
    } catch (error) {
      defaultLog.error({ label: 'getActiveSecurityCategories', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

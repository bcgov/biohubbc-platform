import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { UserService } from '../../../services/user-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/user');

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
  getRoleList()
];

GET.apiDoc = {
  description: 'Get all Roles.',
  tags: ['roles'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'Role response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'Role Response Object',
              type: 'object',
              required: ['system_role_id', 'name'],
              properties: {
                system_role_id: {
                  type: 'integer',
                  minimum: 1
                },
                name: {
                  type: 'string'
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
 * Get all roles.
 *
 * @returns {RequestHandler}
 */
export function getRoleList(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const userService = new UserService(connection);

      const response = await userService.getRoles();

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getRoleList', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

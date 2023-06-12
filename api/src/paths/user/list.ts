import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { UserService } from '../../services/user-service';
import { getLogger } from '../../utils/logger';

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
  getUserList()
];

GET.apiDoc = {
  description: 'Get all Users.',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'User response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
              title: 'User Response Object',
              type: 'object',
              properties: {
                id: {
                  type: 'number'
                },
                user_identifier: {
                  type: 'string'
                },
                user_guid: {
                  type: 'string',
                  description: 'The GUID for the user.'
                },
                role_ids: {
                  type: 'array',
                  items: {
                    oneOf: [{ type: 'number' }, { type: 'string' }]
                  }
                },
                role_names: {
                  type: 'array',
                  items: {
                    type: 'string'
                  }
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
 * Get all users.
 *
 * @returns {RequestHandler}
 */
export function getUserList(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const userService = new UserService(connection);

      const response = await userService.listSystemUsers();

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getUserList', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}

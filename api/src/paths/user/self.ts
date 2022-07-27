import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { UserService } from '../../services/user-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/user/{userId}');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  getUser()
];

GET.apiDoc = {
  description: 'Get user details for the currently authenticated user.',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'User details for the currently authenticated user.',
      content: {
        'application/json': {
          schema: {
            title: 'User Response Object',
            type: 'object',
            required: ['id', 'user_identifier', 'role_ids', 'role_names'],
            properties: {
              id: {
                description: 'user id',
                type: 'number'
              },
              user_identifier: {
                description: 'The unique user identifier',
                type: 'string'
              },
              record_end_date: {
                oneOf: [{ type: 'object' }, { type: 'string', format: 'date' }],
                description: 'Determines if the user record has expired',
                nullable: true
              },
              role_ids: {
                description: 'list of role ids for the user',
                type: 'array',
                items: {
                  type: 'number'
                }
              },
              role_names: {
                description: 'list of role names for the user',
                type: 'array',
                items: {
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
 * Get a user by its user identifier.
 *
 * @returns {RequestHandler}
 */
export function getUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    console.log('connection is: ', connection);

    try {
      await connection.open();

      const userId = connection.systemUserId();

      console.log('user id is: ', userId);

      if (!userId) {
        throw new HTTP400('Failed to identify system user ID');
      }

      const userService = new UserService(connection);

      const userObject = await userService.getUserById(userId);

      if (!userObject) {
        throw new HTTP400('Failed to get system user');
      }

      await connection.commit();

      return res.status(200).json(userObject);
    } catch (error) {
      defaultLog.error({ label: 'getUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

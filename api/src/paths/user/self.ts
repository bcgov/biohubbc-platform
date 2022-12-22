import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { UserObject } from '../../models/user';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { UserService } from '../../services/user-service';
import { getUserGuid, getUserIdentifier, getUserIdentitySource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/user/self');

export const GET: Operation = [
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
    const keycloakToken = req['keycloak_token']
    let userService: UserService;
    let userId: number;
    let userObject: UserObject | null = null;

    // Contains user context
    const connection = getDBConnection(keycloakToken);

    // Use APIUser connection to create a new system user if they don't exist
    const apiConnection = getAPIUserDBConnection();

    try {
      await connection.open();

      // Gets the currently authenticated user's `userId` from the connection's user context. If one isn't set, we attempt to
      // create the user, which will succeed if they don't exist, or do nothing if they do exist.
      userId = connection.systemUserId();

      if (!userId) {
        console.log("!userId")
        connection.release();
        await apiConnection.open();

        userService = new UserService(apiConnection);

        const identitySource = getUserIdentitySource(keycloakToken)
        const userIdentifier = getUserIdentifier(keycloakToken)
        const userGuid = getUserGuid(keycloakToken)

        if (!userGuid || !userIdentifier) {
          throw new HTTP400("Failed to retreive user's identifier or GUID");
        }

        userObject = await userService.getOrCreateSystemUser(userGuid, userIdentifier, identitySource);
        userId = userObject.id
      }

      if (!userId) {
        userService = new UserService(connection);
        userObject = await userService.getUserById(userId);
      }
      
      await apiConnection.commit();
      await connection.commit();

      return res.status(200).json(userObject);
    } catch (error) {
      defaultLog.error({ label: 'getUser', message: 'error', error });
      await connection.rollback();
      await apiConnection.rollback();
      throw error;
    } finally {
      connection.release();
      apiConnection.release();
    }
  };
}

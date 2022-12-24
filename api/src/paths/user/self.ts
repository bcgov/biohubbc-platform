import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { UserService } from '../../services/user-service';
import { getUserGuid, getUserIdentifier, getUserIdentitySource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/user/self');

export const GET: Operation = [getUser()];

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
    const keycloakToken = req['keycloak_token'];

    // Use APIUser connection to get or create a new system user if they don't exist
    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const userService = new UserService(connection);

      // Parse GUID, user identity from keycloak token
      const userGuid = getUserGuid(keycloakToken);
      const userIdentifier = getUserIdentifier(keycloakToken);
      const userIdentitySource = getUserIdentitySource(keycloakToken);

      defaultLog.debug({ label: 'getUser', userGuid, userIdentifier, userIdentitySource });

      if (!userGuid || !userIdentifier || !userIdentitySource) {
        throw new HTTP400("Failed to retreive user's identifier or GUID");
      }

      // Retreives the system user if they exist, or creates a system user if they do not
      const userObject = await userService.getOrCreateSystemUser(userGuid, userIdentifier, userIdentitySource);

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

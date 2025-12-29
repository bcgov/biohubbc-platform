import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { IUserProfile, UserService } from '../../services/user-service';
import {
  getAgency,
  getDisplayName,
  getEmail,
  getFamilyName,
  getGivenName,
  getUserGuid,
  getUserIdentifier,
  getUserIdentitySource
} from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/user/self');

export const PUT: Operation = [upsertUser()];

PUT.apiDoc = {
  description:
    'Upsert the currently authenticated user. Creates a new user with Member role if not found, or updates profile fields if the user exists and is active. Returns 401 if the user is expired.',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'User profile updated successfully.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/SystemUser'
          }
        }
      }
    },
    201: {
      description: 'User successfully created.',
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/SystemUser'
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
 * Upsert the currently authenticated user.
 *
 * - If user doesn't exist: creates with Member role (returns 201)
 * - If user exists and is active: updates profile fields (returns 200)
 * - If user exists but is expired: throws 401
 *
 * @returns {RequestHandler}
 */
export function upsertUser(): RequestHandler {
  return async (req, res) => {
    // Use API user connection since the user may not exist yet
    const connection = getAPIUserDBConnection();

    try {
      // Extract user details from JWT token
      const userGuid = getUserGuid(req.keycloak_token);
      const userIdentifier = getUserIdentifier(req.keycloak_token);
      const identitySource = getUserIdentitySource(req.keycloak_token);

      if (!userGuid) {
        throw new HTTP400('Failed to identify user GUID from token');
      }

      if (!userIdentifier) {
        throw new HTTP400('Failed to identify user identifier from token');
      }

      // Extract profile fields from token
      const profile: IUserProfile = {
        displayName: getDisplayName(req.keycloak_token),
        email: getEmail(req.keycloak_token),
        givenName: getGivenName(req.keycloak_token),
        familyName: getFamilyName(req.keycloak_token),
        agency: getAgency(req.keycloak_token)
      };

      await connection.open();

      const userService = new UserService(connection);

      // Upsert user - creates if not found, updates if active, throws 401 if expired
      const { user, created } = await userService.upsertSelf(userGuid, userIdentifier, identitySource, profile);

      await connection.commit();

      return res.status(created ? 201 : 200).json(user);
    } catch (error) {
      defaultLog.error({ label: 'upsertUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

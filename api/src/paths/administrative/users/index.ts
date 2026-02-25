import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { AvailableUsersListResponseSchema } from '../../../openapi/schemas/team-member';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { UserService } from '../../../services/user-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/users');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getAvailableUsers()
];

GET.apiDoc = {
  description: 'Get available users for team membership (excludes SYSTEM and DATABASE users).',
  tags: ['user'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'search',
      schema: { type: 'string' },
      description: 'Search term to filter users by user_identifier (case-insensitive partial match)'
    }
  ],
  responses: {
    200: {
      description: 'List of available users',
      content: {
        'application/json': {
          schema: AvailableUsersListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get available users for team membership (excludes SYSTEM and DATABASE users).
 *
 * Supports optional search parameter for server-side filtering.
 *
 * @returns {RequestHandler}
 */
export function getAvailableUsers(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const search = req.query.search as string | undefined;

      const userService = new UserService(connection);
      const users = await userService.getAvailableUsers(search);

      await connection.commit();
      return res.status(200).json({ users });
    } catch (error) {
      defaultLog.error({ label: 'getAvailableUsers', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

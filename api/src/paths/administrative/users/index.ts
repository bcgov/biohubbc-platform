import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_IDENTITY_SOURCE } from '../../../constants/database';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection, getKnex } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { AvailableUsersListResponseSchema } from '../../../openapi/schemas/team';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/users');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }]
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
      content: { 'application/json': { schema: AvailableUsersListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Maximum number of users to return in a single request.
 */
const MAX_USERS_LIMIT = 50;

/**
 * Get available users for team membership (excludes SYSTEM and DATABASE users).
 *
 * Supports optional search parameter for server-side filtering.
 * Returns at most MAX_USERS_LIMIT users to ensure good performance with large user bases.
 *
 * @returns {RequestHandler}
 */
export function getAvailableUsers(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const search = req.query.search as string | undefined;

      const knex = getKnex();
      const query = knex
        .table('system_user as su')
        .select(['su.system_user_id', 'su.user_identifier'])
        .innerJoin('user_identity_source as uis', 'su.user_identity_source_id', 'uis.user_identity_source_id')
        .whereNull('su.record_end_date')
        .whereNotIn('uis.name', [SYSTEM_IDENTITY_SOURCE.SYSTEM, SYSTEM_IDENTITY_SOURCE.DATABASE])
        .orderBy('su.user_identifier', 'asc')
        .limit(MAX_USERS_LIMIT);

      // Apply search filter if provided
      if (search && search.trim()) {
        query.whereILike('su.user_identifier', `%${search.trim()}%`);
      }

      const response = await connection.knex(query);

      await connection.commit();
      return res.status(200).json({ users: response.rows });
    } catch (error) {
      defaultLog.error({ label: 'getAvailableUsers', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

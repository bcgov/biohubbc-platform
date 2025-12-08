import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { CreateTeamRequestSchema, TeamsListResponseSchema, TeamWithMembersSchema } from '../../../openapi/schemas/team';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TeamService } from '../../../services/access-policy/team-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/teams');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }]
  })),
  getTeams()
];

GET.apiDoc = {
  description: 'Get all teams with optional pagination and search.',
  tags: ['team'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'page',
      schema: { type: 'integer', default: 0 },
      description: 'Page number (0-indexed)'
    },
    {
      in: 'query',
      name: 'limit',
      schema: { type: 'integer', default: 50 },
      description: 'Items per page (max 100)'
    },
    {
      in: 'query',
      name: 'search',
      schema: { type: 'string' },
      description: 'Search by team name'
    }
  ],
  responses: {
    200: {
      description: 'List of teams with members',
      content: { 'application/json': { schema: TeamsListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all teams with pagination.
 *
 * @returns {RequestHandler}
 */
export function getTeams(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const page = Number(req.query.page) || 0;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const search = req.query.search as string | undefined;

    try {
      await connection.open();
      const teamService = new TeamService(connection);
      const result = await teamService.getTeamsWithMembers({ page, limit, search });
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getTeams', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }]
  })),
  createTeam()
];

POST.apiDoc = {
  description: 'Create a new team with members.',
  tags: ['team'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: CreateTeamRequestSchema } }
  },
  responses: {
    201: {
      description: 'Team created',
      content: { 'application/json': { schema: TeamWithMembersSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new team with members.
 *
 * @returns {RequestHandler}
 */
export function createTeam(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const { name, description, member_user_ids } = req.body;

    try {
      await connection.open();
      const teamService = new TeamService(connection);
      const result = await teamService.createTeamWithMembers({ name, description }, member_user_ids || []);
      await connection.commit();
      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createTeam', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

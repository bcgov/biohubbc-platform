import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { CreateTeam } from '../../../models/team';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { CreateTeamRequestSchema, TeamSchema, TeamsListResponseSchema } from '../../../openapi/schemas/team';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TeamService } from '../../../services/access-policy/team-service';
import { getLogger } from '../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/teams');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getTeams()
];

GET.apiDoc = {
  description: 'Get all teams with optional pagination and search (includes member_count only).',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search by team name'
    }
  ],
  responses: {
    200: {
      description: 'List of teams with member counts',
      content: {
        'application/json': {
          schema: TeamsListResponseSchema
        }
      }
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
    const search = req.query.search as string | undefined;

    try {
      await connection.open();

      const teamService = new TeamService(connection);
      const filters = { search };
      const pagination = makePaginationOptionsFromRequest(req);

      const [teams, count] = await Promise.all([
        teamService.getTeams(filters, ensureCompletePaginationOptions(pagination)),
        teamService.getTeamsCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ teams, pagination: makePaginationResponse(count, pagination) });
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
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTeam()
];

POST.apiDoc = {
  description: 'Create a new team.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateTeamRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Team created',
      content: {
        'application/json': {
          schema: TeamSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new team.
 *
 * @returns {RequestHandler}
 */
export function createTeam(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const { name, description, system_user_ids } = req.body as CreateTeam;

    try {
      await connection.open();
      const teamService = new TeamService(connection);
      const result = await teamService.createTeam({ name, description, system_user_ids });
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

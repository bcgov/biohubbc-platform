import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import {
  TeamMemberByUserRequestSchema,
  TeamMemberSchema,
  TeamMembersListResponseSchema
} from '../../../../../openapi/schemas/team-member';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TeamMemberService } from '../../../../../services/access-policy/team-member-service';
import { getLogger } from '../../../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/teams/{teamId}/member');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getTeamMembers()
];

GET.apiDoc = {
  description: 'Get paginated members for a team by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'teamId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Team ID'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated team members',
      content: {
        'application/json': {
          schema: TeamMembersListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get paginated members for a team by ID.
 *
 * @returns {RequestHandler}
 */
export function getTeamMembers(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const teamMemberService = new TeamMemberService(connection);

      const [members, count] = await Promise.all([
        teamMemberService.getTeamMembersWithUsers(teamId, ensureCompletePaginationOptions(pagination)),
        teamMemberService.getTeamMembersWithUsersCount(teamId)
      ]);
      await connection.commit();
      return res.status(200).json({ members, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getTeamMembers', message: 'error', error });
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
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTeamMember()
];

POST.apiDoc = {
  description: 'Add a member to a team by system user ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'teamId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Team ID'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: TeamMemberByUserRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Team member association',
      content: {
        'application/json': {
          schema: TeamMemberSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  deleteTeamMember()
];

DELETE.apiDoc = {
  description: 'Remove a member from a team by system user ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'teamId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Team ID'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: TeamMemberByUserRequestSchema
      }
    }
  },
  responses: {
    204: { description: 'Team member removed' },
    ...defaultErrorResponses
  }
};

/**
 * Add a member to a team by system user ID.
 *
 * @returns {RequestHandler}
 */
export function createTeamMember(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;
    const { system_user_id } = req.body;

    try {
      await connection.open();
      const teamMemberService = new TeamMemberService(connection);
      const created = await teamMemberService.createTeamMember({ team_id: teamId, system_user_id });

      await connection.commit();
      return res.status(200).json(created);
    } catch (error) {
      defaultLog.error({ label: 'createTeamMember', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Remove a member from a team by system user id.
 *
 * @returns {RequestHandler}
 */
export function deleteTeamMember(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;
    const { system_user_id } = req.body;

    try {
      await connection.open();
      const teamMemberService = new TeamMemberService(connection);
      await teamMemberService.deleteTeamMember(teamId, system_user_id);

      await connection.commit();
      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTeamMember', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

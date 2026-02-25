import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TeamWithMemberCountSchema, UpdateTeamRequestSchema } from '../../../../openapi/schemas/team';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TeamMemberService } from '../../../../services/access-policy/team-member-service';
import { TeamService } from '../../../../services/access-policy/team-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/teams/{teamId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getTeam()
];

GET.apiDoc = {
  description: 'Get a team by ID.',
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
  responses: {
    200: {
      description: 'Team',
      content: {
        'application/json': {
          schema: TeamWithMemberCountSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a team by ID.
 *
 * @returns {RequestHandler}
 */
export function getTeam(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;

    try {
      await connection.open();
      const teamService = new TeamService(connection);
      const result = await teamService.getTeam(teamId);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getTeam', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  updateTeam()
];

PUT.apiDoc = {
  description: 'Update an existing team and its members.',
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
        schema: UpdateTeamRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Team updated',
      content: {
        'application/json': {
          schema: TeamWithMemberCountSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update an existing team and its members.
 *
 * @returns {RequestHandler}
 */
export function updateTeam(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;
    const { name, description, system_user_ids } = req.body;

    try {
      await connection.open();
      const teamService = new TeamService(connection);
      const teamMemberService = new TeamMemberService(connection);

      await teamService.updateTeam(teamId, { name, description });

      const currentMembers = await teamMemberService.getTeamMembers(teamId);
      const currentUserIds = new Set(currentMembers.map((member) => member.system_user_id));
      const newUserIds = new Set(system_user_ids || []);

      const toAdd = (system_user_ids || []).filter((userId: number) => !currentUserIds.has(userId));
      const toRemove = currentMembers.filter((member) => !newUserIds.has(member.system_user_id));

      await Promise.all(
        toAdd.map((userId: number) =>
          teamMemberService.createTeamMember({
            team_id: teamId,
            system_user_id: userId
          })
        )
      );

      await Promise.all(toRemove.map((member) => teamMemberService.deleteTeamMember(member.team_member_id)));

      const result = await teamService.getTeam(teamId);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateTeam', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  deleteTeam()
];

DELETE.apiDoc = {
  description: 'Soft delete a team by ID.',
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
  responses: {
    200: {
      description: 'Team deleted',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Soft delete a team by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteTeam(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;

    try {
      await connection.open();
      const teamService = new TeamService(connection);
      await teamService.deleteTeam(teamId);
      await connection.commit();
      return res.status(200).json({ message: 'Team deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteTeam', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

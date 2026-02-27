import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { TeamMemberService } from '../../../../../../services/access-policy/team-member-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/teams/{teamId}/member/{teamMemberId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  deleteTeamMember()
];

DELETE.apiDoc = {
  description: 'Delete a team member association by ID.',
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
    {
      in: 'path',
      name: 'teamMemberId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Team member ID'
    }
  ],
  responses: {
    204: { description: 'Team member deleted' },
    ...defaultErrorResponses
  }
};

/**
 * Delete a team member association.
 *
 * @returns {RequestHandler}
 */
export function deleteTeamMember(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamMemberId = req.params.teamMemberId;

    try {
      await connection.open();
      const teamMemberService = new TeamMemberService(connection);
      await teamMemberService.deleteTeamMember(teamMemberId);

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

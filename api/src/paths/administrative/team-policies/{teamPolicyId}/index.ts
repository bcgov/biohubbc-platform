import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TeamPolicyService } from '../../../../services/access-policy/team-policy-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/team-policies/{teamPolicyId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  deleteTeamPolicy()
];

DELETE.apiDoc = {
  description: 'Delete a team-policy association.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'teamPolicyId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true,
      description: 'Team-policy association ID'
    }
  ],
  responses: {
    204: {
      description: 'Team-policy association deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Delete a team-policy association (soft delete).
 *
 * @returns {RequestHandler}
 */
export function deleteTeamPolicy(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const teamPolicyId = req.params.teamPolicyId;

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      await teamPolicyService.deleteTeamPolicy(teamPolicyId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTeamPolicy', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

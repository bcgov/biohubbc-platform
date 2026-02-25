import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { CreateTeamPoliciesRequest } from '../../../../../models/team-policy';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CreateTeamPoliciesRequestSchema, TeamPoliciesSchema } from '../../../../../openapi/schemas/team-policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/teams/{teamId}/policy');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTeamPolicies()
];

POST.apiDoc = {
  description: 'Create team-policy associations in bulk for a team.',
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
    description: 'Policy IDs to assign to the team.',
    required: true,
    content: {
      'application/json': {
        schema: CreateTeamPoliciesRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Processed team-policy associations for this request.',
      content: {
        'application/json': {
          schema: TeamPoliciesSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create team-policy associations in bulk.
 *
 * @returns {RequestHandler}
 */
export function createTeamPolicies(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const teamId = req.params.teamId;
    const { policies } = req.body as CreateTeamPoliciesRequest;

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const teamPolicies = await teamPolicyService.createTeamPolicies(teamId, policies);

      await connection.commit();

      return res.status(201).json({ team_policies: teamPolicies });
    } catch (error) {
      defaultLog.error({ label: 'createTeamPolicies', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

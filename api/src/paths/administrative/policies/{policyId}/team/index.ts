import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { CreateTeamPolicy } from '../../../../../models/team-policy';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CreateTeamPolicyRequestSchema, TeamPolicySchema } from '../../../../../openapi/schemas/team-policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/team');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createPolicyTeam()
];

POST.apiDoc = {
  description: 'Associate a team with a policy.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'policyId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Policy ID'
    }
  ],
  requestBody: {
    description: 'Team ID to associate with the policy.',
    required: true,
    content: {
      'application/json': {
        schema: CreateTeamPolicyRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'The created team-policy association.',
      content: {
        'application/json': {
          schema: TeamPolicySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Associate a team with a policy.
 *
 * @returns {RequestHandler}
 */
export function createPolicyTeam(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const { team_id } = req.body as Pick<CreateTeamPolicy, 'team_id'>;

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const response = await teamPolicyService.createTeamPolicy({ team_id, policy_id: policyId });

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createPolicyTeam', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

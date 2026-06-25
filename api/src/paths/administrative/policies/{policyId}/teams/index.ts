import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import { PolicyTeamsResponseSchema } from '../../../../../openapi/schemas/team-policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TeamPolicyService } from '../../../../../services/access-policy/team-policy-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/teams');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getPolicyTeams()
];

GET.apiDoc = {
  description: 'Get teams associated with a policy.',
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
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated teams associated with the policy.',
      content: {
        'application/json': {
          schema: PolicyTeamsResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get teams associated with a policy.
 *
 * @returns {RequestHandler}
 */
export function getPolicyTeams(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const [teams, count] = await Promise.all([
        teamPolicyService.getTeamsByPolicyId(policyId, pagination),
        teamPolicyService.getTeamsByPolicyIdCount(policyId)
      ]);

      await connection.commit();

      return res.status(200).json({ teams, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getPolicyTeams', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { TeamPoliciesResponseSchema } from '../../../../openapi/schemas/team-policy';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TeamPolicyService } from '../../../../services/access-policy/team-policy-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/policies/team');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getPolicyTeamAssignments()
];

GET.apiDoc = {
  description: 'Get all team-policy associations with team and policy names.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter by team or policy name'
    },
    {
      in: 'query',
      name: 'policyIds',
      required: false,
      schema: { type: 'array', items: { type: 'string', format: 'uuid' } },
      description: 'Policy IDs to filter by'
    }
  ],
  responses: {
    200: {
      description: 'List of team-policy associations.',
      content: {
        'application/json': {
          schema: TeamPoliciesResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all team-policy associations with names for display.
 *
 * @returns {RequestHandler}
 */
export function getPolicyTeamAssignments(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const search = req.query.search as string | undefined;
    const policyIdsQuery = req.query.policyIds ?? req.query['policyIds[]'];
    let policyIds: string[] | undefined;

    if (typeof policyIdsQuery === 'string') {
      policyIds = [policyIdsQuery];
    } else if (Array.isArray(policyIdsQuery)) {
      policyIds = policyIdsQuery.map(String);
    }

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const filters = { search, policyIds };
      const pagination = makePaginationOptionsFromRequest(req);
      const [teamPolicies, count] = await Promise.all([
        teamPolicyService.getAllTeamPolicies(filters, pagination),
        teamPolicyService.getAllTeamPoliciesCount(filters)
      ]);

      await connection.commit();

      return res
        .status(200)
        .json({ team_policies: teamPolicies, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getPolicyTeamAssignments', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

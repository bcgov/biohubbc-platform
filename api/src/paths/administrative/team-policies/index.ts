import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import {
  CreateTeamPolicyRequestSchema,
  TeamPoliciesResponseSchema,
  TeamPolicySchema
} from '../../../openapi/schemas/team-policy';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TeamPolicyService } from '../../../services/access-policy/team-policy-service';
import { getLogger } from '../../../utils/logger';
import { ApiPaginationOptions } from '../../../zod-schema/pagination';

const defaultLog = getLogger('paths/administrative/team-policies');

export const GET: Operation = [
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
  getTeamPolicies()
];

GET.apiDoc = {
  description: 'Get all team-policy associations with team and policy names.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'page',
      required: false,
      schema: { type: 'integer', minimum: 1 },
      description: 'Page number (1-indexed, defaults to 1)'
    },
    {
      in: 'query',
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100 },
      description: 'Items per page (defaults to 10, max 100)'
    },
    {
      in: 'query',
      name: 'sort',
      required: false,
      schema: { type: 'string' },
      description: 'Column to sort by (e.g., team_name, policy_name)'
    },
    {
      in: 'query',
      name: 'order',
      required: false,
      schema: { type: 'string', enum: ['asc', 'desc'] },
      description: 'Sort direction'
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
export function getTeamPolicies(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const pagination: ApiPaginationOptions = {
      page: Number(req.query.page) || 1,
      limit: Math.min(Number(req.query.limit) || 10, 100),
      sort: req.query.sort as string | undefined,
      order: req.query.order as 'asc' | 'desc' | undefined
    };

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const response = await teamPolicyService.getAllTeamPoliciesWithPagination(pagination);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getTeamPolicies', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
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
  createTeamPolicy()
];

POST.apiDoc = {
  description: 'Create a new team-policy association.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Team and policy IDs to associate.',
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
 * Create a new team-policy association.
 *
 * @returns {RequestHandler}
 */
export function createTeamPolicy(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const { team_id, policy_id } = req.body;

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const response = await teamPolicyService.createTeamPolicy({ team_id, policy_id });

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createTeamPolicy', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

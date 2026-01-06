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

    try {
      await connection.open();

      const teamPolicyService = new TeamPolicyService(connection);
      const teamPolicies = await teamPolicyService.getAllTeamPolicies();

      await connection.commit();

      return res.status(200).json({ team_policies: teamPolicies });
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import {
  CreatePolicyRequestSchema,
  PoliciesListResponseSchema,
  PolicyWithStatementsSchema
} from '../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { PolicyService } from '../../../services/access-policy/policy-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies');

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
  getPolicies()
];

GET.apiDoc = {
  description: 'Get all policies with their statements and conditions.',
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
      schema: {
        type: 'integer',
        minimum: 0,
        default: 0
      },
      description: 'Page number (0-indexed)'
    },
    {
      in: 'query',
      name: 'limit',
      schema: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 50
      },
      description: 'Number of items per page'
    },
    {
      in: 'query',
      name: 'search',
      schema: {
        type: 'string'
      },
      description: 'Search term to filter policies by name'
    }
  ],
  responses: {
    200: {
      description: 'List of policies with statements.',
      content: {
        'application/json': {
          schema: PoliciesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all policies with pagination.
 *
 * @returns {RequestHandler}
 */
export function getPolicies(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 50;
    const search = req.query.search as string | undefined;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.getPoliciesWithStatements({ page, limit, search });

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getPolicies', message: 'error', error });
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
  createPolicy()
];

POST.apiDoc = {
  description: 'Create a new policy with statements.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Policy to create.',
    required: true,
    content: {
      'application/json': {
        schema: CreatePolicyRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'The created policy with statements.',
      content: {
        'application/json': {
          schema: PolicyWithStatementsSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a new policy with statements.
 *
 * @returns {RequestHandler}
 */
export function createPolicy(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const { name, description, statements } = req.body;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.createPolicyWithStatements({ name, description }, statements || []);

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createPolicy', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

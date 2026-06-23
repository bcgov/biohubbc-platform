import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { CreatePolicyDefinition } from '../../../models/policy';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import {
  CreatePolicyRequestSchema,
  PoliciesListResponseSchema,
  PolicyWithStatementsSchema
} from '../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { PolicyService } from '../../../services/access-policy/policy-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

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
  description: 'Get all policies with their statements.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
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

    const search = req.query.search as string | undefined;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const filters = { search };
      const pagination = makePaginationOptionsFromRequest(req);
      const [policies, count] = await Promise.all([
        policyService.getPoliciesWithStatements(filters, pagination),
        policyService.getPoliciesCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ policies, pagination: makePaginationResponse(count, pagination) });
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

    const { name, description, statements } = req.body as CreatePolicyDefinition;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.createPolicyWithStatements(
        { name, description, status: 'requested' },
        statements
      );

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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { ExpressionTree } from '../../../../../models/expression-tree';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import {
  CreatePolicyExpressionRequestSchema,
  PolicyExpressionsListResponseSchema,
  PolicyExpressionWithExpressionSchema
} from '../../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { PolicyService } from '../../../../../services/access-policy/policy-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/expressions');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getPolicyExpressions()
];

GET.apiDoc = {
  description: 'Get policy expressions for a policy.',
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
      description: 'Paginated policy expressions.',
      content: {
        'application/json': {
          schema: PolicyExpressionsListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createPolicyExpression()
];

POST.apiDoc = {
  description: 'Create a policy expression.',
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
    description: 'Policy expression to create.',
    required: true,
    content: {
      'application/json': {
        schema: CreatePolicyExpressionRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'The created policy expression.',
      content: {
        'application/json': {
          schema: PolicyExpressionWithExpressionSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

interface CreatePolicyExpressionRequest {
  name: string;
  description?: string | null;
  expression: ExpressionTree;
}

/**
 * Get policy expressions for a policy.
 *
 * @returns {RequestHandler}
 */
export function getPolicyExpressions(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const [expressions, count] = await Promise.all([
        policyService.getPolicyExpressionsWithExpression(policyId, pagination),
        policyService.getPolicyExpressionsCount(policyId)
      ]);

      await connection.commit();

      return res.status(200).json({ expressions, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getPolicyExpressions', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Create a policy expression.
 *
 * @returns {RequestHandler}
 */
export function createPolicyExpression(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const { name, description, expression } = req.body as CreatePolicyExpressionRequest;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.createPolicyExpression(policyId, {
        name,
        description: description ?? null,
        expression
      });

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createPolicyExpression', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { ExpressionTree } from '../../../../../../models/expression-tree';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import {
  CreatePolicyExpressionRequestSchema,
  PolicyExpressionWithExpressionSchema
} from '../../../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { PolicyService } from '../../../../../../services/access-policy/policy-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/expressions/{policyExpressionId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updatePolicyExpression()
];

PUT.apiDoc = {
  description: 'Update a policy expression.',
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
    {
      in: 'path',
      name: 'policyExpressionId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Policy expression ID'
    }
  ],
  requestBody: {
    description: 'Policy expression update.',
    required: true,
    content: {
      'application/json': {
        schema: CreatePolicyExpressionRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'The updated policy expression.',
      content: {
        'application/json': {
          schema: PolicyExpressionWithExpressionSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deletePolicyExpression()
];

DELETE.apiDoc = {
  description: 'Delete a policy expression.',
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
    {
      in: 'path',
      name: 'policyExpressionId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Policy expression ID'
    }
  ],
  responses: {
    204: {
      description: 'Policy expression deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

interface UpdatePolicyExpressionRequest {
  name: string;
  description?: string | null;
  expression: ExpressionTree;
}

/**
 * Update a policy expression.
 *
 * @returns {RequestHandler}
 */
export function updatePolicyExpression(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const policyExpressionId = req.params.policyExpressionId;
    const { name, description, expression } = req.body as UpdatePolicyExpressionRequest;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.updatePolicyExpression(policyId, policyExpressionId, {
        name,
        description: description ?? null,
        expression
      });

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'updatePolicyExpression', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Delete a policy expression.
 *
 * @returns {RequestHandler}
 */
export function deletePolicyExpression(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const policyExpressionId = req.params.policyExpressionId;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      await policyService.deletePolicyExpression(policyId, policyExpressionId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deletePolicyExpression', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

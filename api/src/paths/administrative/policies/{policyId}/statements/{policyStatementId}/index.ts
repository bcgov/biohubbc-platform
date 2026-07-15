import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { HTTP400 } from '../../../../../../errors/http-error';
import { CreatePolicyStatementPayload } from '../../../../../../models/policy-statement';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import {
  CreatePolicyStatementPayloadSchema,
  PolicyStatementWithExpressionSchema
} from '../../../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { PolicyStatementService } from '../../../../../../services/access-policy/policy-statement-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/statements/{policyStatementId}');

const pathParameters = [
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
    name: 'policyStatementId',
    required: true,
    schema: {
      type: 'string',
      format: 'uuid'
    },
    description: 'Policy statement ID'
  }
];

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updatePolicyStatement()
];

PUT.apiDoc = {
  description: 'Update a policy statement.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: pathParameters,
  requestBody: {
    description: 'Policy statement update.',
    required: true,
    content: {
      'application/json': {
        schema: CreatePolicyStatementPayloadSchema
      }
    }
  },
  responses: {
    200: {
      description: 'The updated policy statement.',
      content: {
        'application/json': {
          schema: PolicyStatementWithExpressionSchema
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
  deletePolicyStatement()
];

DELETE.apiDoc = {
  description: 'Delete a policy statement.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: pathParameters,
  responses: {
    204: {
      description: 'Policy statement deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Update a policy statement.
 *
 * @returns {RequestHandler}
 */
export function updatePolicyStatement(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const policyStatementId = req.params.policyStatementId;
    const { effect, submission_feature_urn, policy_expression_id } = req.body as CreatePolicyStatementPayload;

    try {
      await connection.open();

      const policyStatementService = new PolicyStatementService(connection);
      const existingStatement = await policyStatementService.getPolicyStatement(policyStatementId);

      if (existingStatement.policy_id !== policyId) {
        throw new HTTP400('Policy statement does not belong to policy');
      }

      const response = await policyStatementService.updatePolicyStatement(policyStatementId, {
        effect,
        submission_feature_urn,
        policy_expression_id
      });

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'updatePolicyStatement', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Delete a policy statement.
 *
 * @returns {RequestHandler}
 */
export function deletePolicyStatement(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const policyStatementId = req.params.policyStatementId;

    try {
      await connection.open();

      const policyStatementService = new PolicyStatementService(connection);
      const existingStatement = await policyStatementService.getPolicyStatement(policyStatementId);

      if (existingStatement.policy_id !== policyId) {
        throw new HTTP400('Policy statement does not belong to policy');
      }

      await policyStatementService.deletePolicyStatement(policyStatementId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deletePolicyStatement', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { CreatePolicyStatementPayload } from '../../../../../models/policy-statement';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import {
  CreatePolicyStatementPayloadSchema,
  PolicyStatementWithExpressionSchema
} from '../../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { PolicyStatementService } from '../../../../../services/access-policy/policy-statement-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/statements');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createPolicyStatement()
];

POST.apiDoc = {
  description: 'Create a policy statement.',
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
    description: 'Policy statement to create.',
    required: true,
    content: {
      'application/json': {
        schema: CreatePolicyStatementPayloadSchema
      }
    }
  },
  responses: {
    201: {
      description: 'The created policy statement.',
      content: {
        'application/json': {
          schema: PolicyStatementWithExpressionSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a policy statement.
 *
 * @returns {RequestHandler}
 */
export function createPolicyStatement(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const policyId = req.params.policyId;
    const { effect, submission_feature_urn, policy_expression_id } = req.body as CreatePolicyStatementPayload;

    try {
      await connection.open();

      const policyStatementService = new PolicyStatementService(connection);
      const response = await policyStatementService.createPolicyStatement({
        policy_id: policyId,
        effect,
        submission_feature_urn,
        policy_expression_id
      });

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({ label: 'createPolicyStatement', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

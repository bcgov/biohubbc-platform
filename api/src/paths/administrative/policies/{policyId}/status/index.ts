import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { PolicySchema, UpdatePolicyStatusRequestSchema } from '../../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { PolicyService } from '../../../../../services/access-policy/policy-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/status');

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  patchPolicyStatus()
];

PATCH.apiDoc = {
  description: 'Update policy lifecycle status',
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
    content: {
      'application/json': {
        schema: UpdatePolicyStatusRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Policy status updated successfully',
      content: {
        'application/json': {
          schema: PolicySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function patchPolicyStatus(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const policy = await policyService.updatePolicy(req.params.policyId, { status: req.body.status });

      await connection.commit();

      return res.status(200).json(policy);
    } catch (error) {
      defaultLog.error({ label: 'patchPolicyStatus', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { PolicyStatus } from '../../../../../models/policy';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { PolicySchema, UpdatePolicyStatusRequestSchema } from '../../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { PolicyService } from '../../../../../services/access-policy/policy-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}/status');

export const PATCH: Operation = [
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
  updatePolicyStatus()
];

PATCH.apiDoc = {
  description: 'Update policy workflow status.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'policyId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true,
      description: 'Policy ID'
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdatePolicyStatusRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Updated policy.',
      content: {
        'application/json': {
          schema: PolicySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function updatePolicyStatus(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.updatePolicyStatus(req.params.policyId, req.body.status as PolicyStatus);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'updatePolicyStatus', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

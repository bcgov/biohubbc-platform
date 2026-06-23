import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreatePolicyDefinition } from '../../../../models/policy';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { PolicyWithStatementsSchema, UpdatePolicyRequestSchema } from '../../../../openapi/schemas/policy';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { PolicyService } from '../../../../services/access-policy/policy-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/policies/{policyId}');

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
  getPolicy()
];

GET.apiDoc = {
  description: 'Get a policy by ID with its statements.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
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
  responses: {
    200: {
      description: 'The policy with statements.',
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
 * Get a policy by ID.
 *
 * @returns {RequestHandler}
 */
export function getPolicy(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const policyId = req.params.policyId;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.getPolicyWithStatements(policyId);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getPolicy', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const PUT: Operation = [
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
  updatePolicy()
];

PUT.apiDoc = {
  description: 'Update a policy with statements.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
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
    description: 'Policy data to update.',
    required: true,
    content: {
      'application/json': {
        schema: UpdatePolicyRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'The updated policy with statements.',
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
 * Update a policy with statements.
 *
 * @returns {RequestHandler}
 */
export function updatePolicy(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const policyId = req.params.policyId;
    const { name, description, status, statements } = req.body as CreatePolicyDefinition;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      const response = await policyService.updatePolicyWithStatements(
        policyId,
        { name, description, status },
        statements
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'updatePolicy', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [
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
  deletePolicy()
];

DELETE.apiDoc = {
  description: 'Delete a policy.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
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
  responses: {
    204: {
      description: 'Policy deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Delete a policy.
 *
 * @returns {RequestHandler}
 */
export function deletePolicy(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const policyId = req.params.policyId;

    try {
      await connection.open();

      const policyService = new PolicyService(connection);
      await policyService.deletePolicy(policyId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deletePolicy', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

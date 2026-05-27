import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { UpdateSecurityReason } from '../../../../../models/security-rule';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SecurityReasonSchema, UpdateSecurityReasonRequestSchema } from '../../../../../openapi/schemas/security';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../../services/security-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/reasons/{securityRuleId}');

const securityAdminAuth = () => ({
  and: [
    {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
      discriminator: 'SystemRole' as const
    }
  ]
});

const securityRuleIdParam = {
  in: 'path',
  name: 'securityRuleId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Security rule ID'
} as const;

export const GET: Operation = [authorizeRequestHandler(securityAdminAuth), getSecurityReason()];

GET.apiDoc = {
  description: 'Get a security reason by ID.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [securityRuleIdParam],
  responses: {
    200: {
      description: 'Security reason',
      content: {
        'application/json': {
          schema: SecurityReasonSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a security reason by ID.
 *
 * @returns {RequestHandler}
 */
export function getSecurityReason(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const securityRuleId = Number(req.params.securityRuleId);

    try {
      await connection.open();

      const securityService = new SecurityService(connection);
      const result = await securityService.getSecurityReason(securityRuleId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSecurityReason', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const PUT: Operation = [authorizeRequestHandler(securityAdminAuth), updateSecurityReason()];

PUT.apiDoc = {
  description: 'Update an existing security reason.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [securityRuleIdParam],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateSecurityReasonRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Security reason updated',
      content: {
        'application/json': {
          schema: SecurityReasonSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update an existing security reason.
 *
 * @returns {RequestHandler}
 */
export function updateSecurityReason(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const securityRuleId = Number(req.params.securityRuleId);
    const payload = req.body as UpdateSecurityReason;

    try {
      await connection.open();

      const securityService = new SecurityService(connection);
      const result = await securityService.updateSecurityReason(securityRuleId, payload);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateSecurityReason', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [authorizeRequestHandler(securityAdminAuth), deleteSecurityReason()];

DELETE.apiDoc = {
  description: 'Soft delete a security reason by ID.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [securityRuleIdParam],
  responses: {
    200: {
      description: 'Security reason deleted',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              message: { type: 'string' }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Soft delete a security reason by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteSecurityReason(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const securityRuleId = Number(req.params.securityRuleId);

    try {
      await connection.open();

      const securityService = new SecurityService(connection);
      await securityService.deleteSecurityReason(securityRuleId);

      await connection.commit();

      return res.status(200).json({ message: 'Security reason deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteSecurityReason', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

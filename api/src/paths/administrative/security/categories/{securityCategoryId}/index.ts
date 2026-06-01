import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { UpdateSecurityCategory } from '../../../../../models/security-category';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SecurityCategorySchema, UpdateSecurityCategoryRequestSchema } from '../../../../../openapi/schemas/security';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SecurityCategoryService } from '../../../../../services/security-category-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/categories/{securityCategoryId}');

const securityAdminAuth = () => ({
  and: [
    {
      validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
      discriminator: 'SystemRole' as const
    }
  ]
});

const securityCategoryIdParam = {
  in: 'path',
  name: 'securityCategoryId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Security category ID'
} as const;

export const GET: Operation = [authorizeRequestHandler(securityAdminAuth), getSecurityCategory()];

GET.apiDoc = {
  description: 'Get a security category by ID.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [securityCategoryIdParam],
  responses: {
    200: {
      description: 'Security category',
      content: {
        'application/json': {
          schema: SecurityCategorySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a security category by ID.
 *
 * @returns {RequestHandler}
 */
export function getSecurityCategory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const securityCategoryId = Number(req.params.securityCategoryId);

    try {
      await connection.open();

      const securityCategoryService = new SecurityCategoryService(connection);
      const result = await securityCategoryService.getSecurityCategory(securityCategoryId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSecurityCategory', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const PUT: Operation = [authorizeRequestHandler(securityAdminAuth), updateSecurityCategory()];

PUT.apiDoc = {
  description: 'Update an existing security category.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [securityCategoryIdParam],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateSecurityCategoryRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Security category updated',
      content: {
        'application/json': {
          schema: SecurityCategorySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update an existing security category.
 *
 * @returns {RequestHandler}
 */
export function updateSecurityCategory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const securityCategoryId = Number(req.params.securityCategoryId);
    const payload = req.body as UpdateSecurityCategory;

    try {
      await connection.open();

      const securityCategoryService = new SecurityCategoryService(connection);
      const result = await securityCategoryService.updateSecurityCategory(securityCategoryId, payload);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateSecurityCategory', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [authorizeRequestHandler(securityAdminAuth), deleteSecurityCategory()];

DELETE.apiDoc = {
  description: 'Soft delete a security category by ID.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [securityCategoryIdParam],
  responses: {
    200: {
      description: 'Security category deleted',
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
 * Soft delete a security category by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteSecurityCategory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const securityCategoryId = Number(req.params.securityCategoryId);

    try {
      await connection.open();

      const securityCategoryService = new SecurityCategoryService(connection);
      await securityCategoryService.deleteSecurityCategory(securityCategoryId);

      await connection.commit();

      return res.status(200).json({ message: 'Security category deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteSecurityCategory', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

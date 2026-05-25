import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { UpdateFeatureType } from '../../../../models/feature-type';
import { FeatureTypeSchema, UpdateFeatureTypeRequestSchema } from '../../../../openapi/schemas/feature-type';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { FeatureTypeService } from '../../../../services/feature-type-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/feature-types/{featureTypeId}');

const featureTypeIdParam = {
  in: 'path',
  name: 'featureTypeId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Feature type ID'
} as const;

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getFeatureType()
];

GET.apiDoc = {
  description: 'Get a feature type by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featureTypeIdParam],
  responses: {
    200: {
      description: 'Feature type',
      content: {
        'application/json': {
          schema: FeatureTypeSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a feature type by ID.
 *
 * @returns {RequestHandler}
 */
export function getFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);

    try {
      await connection.open();

      const featureTypeService = new FeatureTypeService(connection);
      const result = await featureTypeService.getFeatureType(featureTypeId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFeatureType', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  updateFeatureType()
];

PUT.apiDoc = {
  description: 'Update an existing feature type.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featureTypeIdParam],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateFeatureTypeRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Feature type updated',
      content: {
        'application/json': {
          schema: FeatureTypeSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update an existing feature type.
 *
 * @returns {RequestHandler}
 */
export function updateFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);
    const payload = req.body as UpdateFeatureType;

    try {
      await connection.open();

      const featureTypeService = new FeatureTypeService(connection);
      const result = await featureTypeService.updateFeatureType(featureTypeId, payload);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateFeatureType', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  deleteFeatureType()
];

DELETE.apiDoc = {
  description: 'Soft delete a feature type by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featureTypeIdParam],
  responses: {
    200: {
      description: 'Feature type deleted',
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
 * Soft delete a feature type by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);

    try {
      await connection.open();

      const featureTypeService = new FeatureTypeService(connection);
      await featureTypeService.deleteFeatureType(featureTypeId);

      await connection.commit();

      return res.status(200).json({ message: 'Feature type deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteFeatureType', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

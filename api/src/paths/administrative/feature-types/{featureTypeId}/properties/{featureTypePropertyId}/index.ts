import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { UpdateFeatureTypePropertyRecord } from '../../../../../../models/feature-type-property';
import {
  AdminFeatureTypePropertySchema,
  UpdateFeatureTypePropertyRequestSchema
} from '../../../../../../openapi/schemas/feature-type-property';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { FeatureTypePropertyService } from '../../../../../../services/feature-type-property-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/feature-types/{featureTypeId}/properties/{featureTypePropertyId}');

const pathParams = [
  {
    in: 'path',
    name: 'featureTypeId',
    required: true,
    schema: { type: 'integer', minimum: 1 },
    description: 'Feature type ID'
  },
  {
    in: 'path',
    name: 'featureTypePropertyId',
    required: true,
    schema: { type: 'integer', minimum: 1 },
    description: 'Feature type property ID'
  }
] as const;

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getFeatureTypeProperty()
];

GET.apiDoc = {
  description: 'Get a feature type property by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  responses: {
    200: {
      description: 'Feature type property',
      content: {
        'application/json': {
          schema: AdminFeatureTypePropertySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a feature type property by ID.
 *
 * @returns {RequestHandler}
 */
export function getFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);
    const featureTypePropertyId = Number(req.params.featureTypePropertyId);

    try {
      await connection.open();

      const featureTypePropertyService = new FeatureTypePropertyService(connection);
      const result = await featureTypePropertyService.getAdminFeatureTypeProperty(featureTypePropertyId, featureTypeId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFeatureTypeProperty', message: 'error', error });
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
  updateFeatureTypeProperty()
];

PUT.apiDoc = {
  description: 'Update an existing feature type property.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateFeatureTypePropertyRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Feature type property updated',
      content: {
        'application/json': {
          schema: AdminFeatureTypePropertySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update an existing feature type property.
 *
 * @returns {RequestHandler}
 */
export function updateFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);
    const featureTypePropertyId = Number(req.params.featureTypePropertyId);
    const payload = req.body as UpdateFeatureTypePropertyRecord;

    try {
      await connection.open();

      const featureTypePropertyService = new FeatureTypePropertyService(connection);
      const result = await featureTypePropertyService.updateFeatureTypeProperty(
        featureTypePropertyId,
        featureTypeId,
        payload
      );

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateFeatureTypeProperty', message: 'error', error });
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
  deleteFeatureTypeProperty()
];

DELETE.apiDoc = {
  description: 'Soft delete a feature type property by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  responses: {
    200: {
      description: 'Feature type property deleted',
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
 * Soft delete a feature type property by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);
    const featureTypePropertyId = Number(req.params.featureTypePropertyId);

    try {
      await connection.open();

      const featureTypePropertyService = new FeatureTypePropertyService(connection);
      await featureTypePropertyService.deleteFeatureTypeProperty(featureTypePropertyId, featureTypeId);

      await connection.commit();

      return res.status(200).json({ message: 'Feature type property deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteFeatureTypeProperty', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

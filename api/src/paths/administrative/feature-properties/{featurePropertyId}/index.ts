import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { UpdateFeatureProperty } from '../../../../models/feature-property';
import {
  FeaturePropertySchema,
  UpdateFeaturePropertyRequestSchema
} from '../../../../openapi/schemas/feature-property';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { FeaturePropertyService } from '../../../../services/feature-property-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/feature-properties/{featurePropertyId}');

const featurePropertyIdParam = {
  in: 'path',
  name: 'featurePropertyId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Feature property ID'
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
  getFeatureProperty()
];

GET.apiDoc = {
  description: 'Get a feature property by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featurePropertyIdParam],
  responses: {
    200: {
      description: 'Feature property',
      content: {
        'application/json': {
          schema: FeaturePropertySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a feature property by ID.
 *
 * @returns {RequestHandler}
 */
export function getFeatureProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featurePropertyId = Number(req.params.featurePropertyId);

    try {
      await connection.open();

      const featurePropertyService = new FeaturePropertyService(connection);
      const result = await featurePropertyService.getFeatureProperty(featurePropertyId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getFeatureProperty', message: 'error', error });
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
  updateFeatureProperty()
];

PUT.apiDoc = {
  description: 'Update an existing feature property.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featurePropertyIdParam],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateFeaturePropertyRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Feature property updated',
      content: {
        'application/json': {
          schema: FeaturePropertySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update an existing feature property.
 *
 * @returns {RequestHandler}
 */
export function updateFeatureProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featurePropertyId = Number(req.params.featurePropertyId);
    const payload = req.body as UpdateFeatureProperty;

    try {
      await connection.open();

      const featurePropertyService = new FeaturePropertyService(connection);
      const result = await featurePropertyService.updateFeatureProperty(featurePropertyId, payload);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateFeatureProperty', message: 'error', error });
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
  deleteFeatureProperty()
];

DELETE.apiDoc = {
  description: 'Soft delete a feature property by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featurePropertyIdParam],
  responses: {
    200: {
      description: 'Feature property deleted',
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
 * Soft delete a feature property by ID.
 *
 * @returns {RequestHandler}
 */
export function deleteFeatureProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featurePropertyId = Number(req.params.featurePropertyId);

    try {
      await connection.open();

      const featurePropertyService = new FeaturePropertyService(connection);
      await featurePropertyService.deleteFeatureProperty(featurePropertyId);

      await connection.commit();

      return res.status(200).json({ message: 'Feature property deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteFeatureProperty', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

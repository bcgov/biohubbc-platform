import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import {
  AdminFeatureTypePropertySchema,
  CreateFeatureTypePropertyRequestSchema,
  FeatureTypePropertiesListResponseSchema
} from '../../../../../openapi/schemas/feature-type-property';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { FeatureTypePropertyService } from '../../../../../services/feature-type-property-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/feature-types/{featureTypeId}/properties');

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
  getFeatureTypeProperties()
];

GET.apiDoc = {
  description: 'Get all active feature type properties for a given feature type.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featureTypeIdParam, ...paginationRequestQueryParamSchema],
  responses: {
    200: {
      description: 'List of active feature type properties',
      content: {
        'application/json': {
          schema: FeatureTypePropertiesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active feature type properties for a feature type.
 *
 * @returns {RequestHandler}
 */
export function getFeatureTypeProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);

    try {
      await connection.open();

      const featureTypePropertyService = new FeatureTypePropertyService(connection);
      const pagination = makePaginationOptionsFromRequest(req);

      const [feature_type_properties, count] = await Promise.all([
        featureTypePropertyService.getAdminFeatureTypeProperties(featureTypeId, pagination),
        featureTypePropertyService.getAdminFeatureTypePropertiesCount(featureTypeId)
      ]);

      await connection.commit();

      return res.status(200).json({ feature_type_properties, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getFeatureTypeProperties', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createFeatureTypeProperty()
];

POST.apiDoc = {
  description: 'Assign a feature property to a feature type.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [featureTypeIdParam],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateFeatureTypePropertyRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Feature type property created',
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
 * Assign a feature property to a feature type.
 *
 * @returns {RequestHandler}
 */
export function createFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const featureTypeId = Number(req.params.featureTypeId);
    const { feature_property_id, required_value, sort } = req.body;

    try {
      await connection.open();

      const featureTypePropertyService = new FeatureTypePropertyService(connection);
      const result = await featureTypePropertyService.createFeatureTypeProperty({
        feature_type_id: featureTypeId,
        feature_property_id,
        required_value,
        sort
      });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createFeatureTypeProperty', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

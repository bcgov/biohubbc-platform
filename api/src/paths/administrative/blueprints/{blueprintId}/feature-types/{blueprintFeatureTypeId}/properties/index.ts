import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import {
  AdminBlueprintFeatureTypePropertySchema,
  BlueprintFeatureTypePropertiesListResponseSchema,
  CreateBlueprintFeatureTypePropertyRequestSchema
} from '../../../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../../../services/blueprint-service';
import { getLogger } from '../../../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../../../utils/pagination';

const defaultLog = getLogger(
  'paths/administrative/blueprints/{blueprintId}/feature-types/{blueprintFeatureTypeId}/properties'
);

const pathParams = [
  {
    in: 'path',
    name: 'blueprintId',
    required: true,
    schema: { type: 'integer', minimum: 1 },
    description: 'Blueprint ID'
  },
  {
    in: 'path',
    name: 'blueprintFeatureTypeId',
    required: true,
    schema: { type: 'integer', minimum: 1 },
    description: 'Blueprint feature type ID'
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
  getBlueprintFeatureTypeProperties()
];

GET.apiDoc = {
  description: 'Get all active properties assigned to a blueprint feature type.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams, ...paginationRequestQueryParamSchema],
  responses: {
    200: {
      description: 'List of properties assigned to the blueprint feature type',
      content: {
        'application/json': {
          schema: BlueprintFeatureTypePropertiesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active properties assigned to a blueprint feature type.
 *
 * @returns {RequestHandler}
 */
export function getBlueprintFeatureTypeProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const pagination = makePaginationOptionsFromRequest(req);

      const [blueprint_feature_type_properties, count] = await Promise.all([
        blueprintService.getAdminBlueprintFeatureTypeProperties(blueprintId, blueprintFeatureTypeId, pagination),
        blueprintService.getAdminBlueprintFeatureTypePropertiesCount(blueprintFeatureTypeId)
      ]);

      await connection.commit();

      return res
        .status(200)
        .json({ blueprint_feature_type_properties, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getBlueprintFeatureTypeProperties', message: 'error', error });
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
  createBlueprintFeatureTypeProperty()
];

POST.apiDoc = {
  description:
    'Assign an existing feature property directly to a feature type of a draft blueprint. The property does not need to be paired with the feature type globally.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateBlueprintFeatureTypePropertyRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Blueprint feature type property created',
      content: {
        'application/json': {
          schema: AdminBlueprintFeatureTypePropertySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Assign a feature property to a feature type of a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function createBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);
    const { feature_property_id, required_value, allow_multiple, sort } = req.body;

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.createBlueprintFeatureTypeProperty(blueprintId, blueprintFeatureTypeId, {
        feature_property_id,
        required_value,
        allow_multiple,
        sort
      });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createBlueprintFeatureTypeProperty', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

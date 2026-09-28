import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../database/db';
import { UpdateBlueprintFeatureTypePropertyRecord } from '../../../../../../../../models/blueprint';
import {
  AdminBlueprintFeatureTypePropertySchema,
  UpdateBlueprintFeatureTypePropertyRequestSchema
} from '../../../../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../../../../services/blueprint-service';
import { getLogger } from '../../../../../../../../utils/logger';

const defaultLog = getLogger(
  'paths/administrative/blueprints/{blueprintId}/feature-types/{blueprintFeatureTypeId}/properties/{blueprintFeatureTypePropertyId}'
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
  },
  {
    in: 'path',
    name: 'blueprintFeatureTypePropertyId',
    required: true,
    schema: { type: 'integer', minimum: 1 },
    description: 'Blueprint feature type property ID'
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
  getBlueprintFeatureTypeProperty()
];

GET.apiDoc = {
  description: 'Get a blueprint feature type property by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  responses: {
    200: {
      description: 'Blueprint feature type property',
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
 * Get a blueprint feature type property by ID.
 *
 * @returns {RequestHandler}
 */
export function getBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);
    const blueprintFeatureTypePropertyId = Number(req.params.blueprintFeatureTypePropertyId);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.getAdminBlueprintFeatureTypeProperty(
        blueprintId,
        blueprintFeatureTypeId,
        blueprintFeatureTypePropertyId
      );

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getBlueprintFeatureTypeProperty', message: 'error', error });
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
  updateBlueprintFeatureTypeProperty()
];

PUT.apiDoc = {
  description:
    'Update whether a property is required, whether it allows multiple values, and its ordering within a feature type of a draft blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateBlueprintFeatureTypePropertyRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Blueprint feature type property updated',
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
 * Update a property assignment of a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function updateBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);
    const blueprintFeatureTypePropertyId = Number(req.params.blueprintFeatureTypePropertyId);
    const payload = req.body as UpdateBlueprintFeatureTypePropertyRecord;

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.updateBlueprintFeatureTypeProperty(
        blueprintId,
        blueprintFeatureTypeId,
        blueprintFeatureTypePropertyId,
        payload
      );

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateBlueprintFeatureTypeProperty', message: 'error', error });
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
  deleteBlueprintFeatureTypeProperty()
];

DELETE.apiDoc = {
  description: 'Retire a property assignment of a draft blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  responses: {
    200: {
      description: 'Blueprint feature type property deleted',
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
 * Retire a property assignment of a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function deleteBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);
    const blueprintFeatureTypePropertyId = Number(req.params.blueprintFeatureTypePropertyId);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      await blueprintService.deleteBlueprintFeatureTypeProperty(
        blueprintId,
        blueprintFeatureTypeId,
        blueprintFeatureTypePropertyId
      );

      await connection.commit();

      return res.status(200).json({ message: 'Blueprint feature type property deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteBlueprintFeatureTypeProperty', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

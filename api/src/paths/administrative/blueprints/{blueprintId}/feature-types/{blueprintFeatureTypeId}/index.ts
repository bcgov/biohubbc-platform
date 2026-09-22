import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { UpdateBlueprintFeatureTypeRecord } from '../../../../../../models/blueprint';
import {
  AdminBlueprintFeatureTypeSchema,
  UpdateBlueprintFeatureTypeRequestSchema
} from '../../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../../services/blueprint-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}/feature-types/{blueprintFeatureTypeId}');

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

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  updateBlueprintFeatureType()
];

PUT.apiDoc = {
  description: 'Update the ordering of a feature type within a draft blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateBlueprintFeatureTypeRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Blueprint feature type updated',
      content: {
        'application/json': {
          schema: AdminBlueprintFeatureTypeSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update a feature type of a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function updateBlueprintFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);
    const payload = req.body as UpdateBlueprintFeatureTypeRecord;

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.updateBlueprintFeatureType(blueprintId, blueprintFeatureTypeId, payload);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateBlueprintFeatureType', message: 'error', error });
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
  deleteBlueprintFeatureType()
];

DELETE.apiDoc = {
  description: 'Remove a feature type from a draft blueprint, retiring its property assignments with it.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...pathParams],
  responses: {
    200: {
      description: 'Blueprint feature type deleted',
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
 * Remove a feature type from a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function deleteBlueprintFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const blueprintFeatureTypeId = Number(req.params.blueprintFeatureTypeId);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      await blueprintService.deleteBlueprintFeatureType(blueprintId, blueprintFeatureTypeId);

      await connection.commit();

      return res.status(200).json({ message: 'Blueprint feature type deleted successfully' });
    } catch (error) {
      defaultLog.error({ label: 'deleteBlueprintFeatureType', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

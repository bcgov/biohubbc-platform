import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import {
  AdminBlueprintFeatureTypeSchema,
  BlueprintFeatureTypesListResponseSchema,
  CreateBlueprintFeatureTypeRequestSchema
} from '../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../services/blueprint-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}/feature-types');

const blueprintIdParam = {
  in: 'path',
  name: 'blueprintId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Blueprint ID'
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
  getBlueprintFeatureTypes()
];

GET.apiDoc = {
  description: 'Get all active feature types included in a blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [blueprintIdParam],
  responses: {
    200: {
      description: 'List of feature types included in the blueprint',
      content: {
        'application/json': {
          schema: BlueprintFeatureTypesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active feature types included in a blueprint.
 *
 * @returns {RequestHandler}
 */
export function getBlueprintFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const blueprint_feature_types = await blueprintService.getAdminBlueprintFeatureTypes(blueprintId);

      await connection.commit();

      return res.status(200).json({ blueprint_feature_types });
    } catch (error) {
      defaultLog.error({ label: 'getBlueprintFeatureTypes', message: 'error', error });
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
  createBlueprintFeatureType()
];

POST.apiDoc = {
  description: 'Include a feature type in a draft blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [blueprintIdParam],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateBlueprintFeatureTypeRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Blueprint feature type created',
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
 * Include a feature type in a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function createBlueprintFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const { feature_type_id, sort } = req.body;

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.createBlueprintFeatureType(blueprintId, { feature_type_id, sort });

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createBlueprintFeatureType', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

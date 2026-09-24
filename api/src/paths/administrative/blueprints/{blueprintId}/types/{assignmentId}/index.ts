import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { OpenAPIV3 } from 'openapi-types';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BlueprintCompositionService } from '../../../../../../services/blueprint-composition-service';
import { BlueprintFeatureTypeService } from '../../../../../../services/blueprint-feature-type-service';
import { getLogger } from '../../../../../../utils/logger';

const BLUEPRINT_FEATURE_TYPE_SCHEMA: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'blueprint_feature_type_id',
    'blueprint_id',
    'feature_type_id',
    'name',
    'display_name',
    'description',
    'sort',
    'record_end_date'
  ],
  properties: {
    blueprint_feature_type_id: {
      type: 'integer'
    },
    blueprint_id: {
      type: 'integer'
    },
    feature_type_id: {
      type: 'integer'
    },
    name: {
      type: 'string'
    },
    display_name: {
      type: 'string'
    },
    description: {
      type: 'string',
      nullable: true
    },
    sort: {
      type: 'integer',
      nullable: true
    },
    record_end_date: {
      type: 'string',
      format: 'date',
      nullable: true
    }
  }
};

const defaultLog = getLogger('paths/administrative/blueprints/types/{assignmentId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteBlueprintFeatureType()
];

DELETE.apiDoc = {
  description: 'Delete a blueprint feature type and its active property assignments.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'blueprintId',
      required: true,
      schema: {
        type: 'integer',
        minimum: 1
      }
    },
    {
      in: 'path',
      name: 'assignmentId',
      required: true,
      schema: {
        type: 'integer',
        minimum: 1
      }
    }
  ],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BLUEPRINT_FEATURE_TYPE_SCHEMA } } },
    ...defaultErrorResponses
  }
};

/**
 * Delete a blueprint feature type and its active property assignments.
 *
 * @returns Authorized request handler.
 */
export function deleteBlueprintFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintCompositionService = new BlueprintCompositionService(connection);

      const response = await blueprintCompositionService.deleteBlueprintFeatureType(
        Number(req.params.blueprintId),
        Number(req.params.assignmentId)
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'deleteBlueprintFeatureType',
        message: 'error',
        error
      });

      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBlueprintFeatureType()
];

GET.apiDoc = {
  description: 'Read a blueprint feature type assignment.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'blueprintId',
      required: true,
      schema: {
        type: 'integer',
        minimum: 1
      }
    },
    {
      in: 'path',
      name: 'assignmentId',
      required: true,
      schema: {
        type: 'integer',
        minimum: 1
      }
    }
  ],
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BLUEPRINT_FEATURE_TYPE_SCHEMA } } },
    ...defaultErrorResponses
  }
};

/**
 * Read scoped assignment metadata.
 *
 * @returns Authorized request handler.
 */
export function getBlueprintFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);

      const response = await blueprintFeatureTypeService.getBlueprintFeatureType(
        Number(req.params.blueprintId),
        Number(req.params.assignmentId)
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'getBlueprintFeatureType',
        message: 'error',
        error
      });

      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { OpenAPIV3 } from 'openapi-types';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BlueprintCompositionService } from '../../../../../../services/blueprint-composition-service';
import { getLogger } from '../../../../../../utils/logger';

const BLUEPRINT_FEATURE_TYPE_PROPERTY_SCHEMA: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: [
    'blueprint_feature_type_id',
    'name',
    'display_name',
    'description',
    'sort',
    'record_end_date',
    'blueprint_feature_type_property_id',
    'feature_property_id',
    'feature_type_name',
    'type_name',
    'required_value',
    'allow_multiple'
  ],
  properties: {
    blueprint_feature_type_id: {
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
    },
    blueprint_feature_type_property_id: {
      type: 'integer'
    },
    feature_property_id: {
      type: 'integer'
    },
    feature_type_name: {
      type: 'string'
    },
    type_name: {
      type: 'string'
    },
    required_value: {
      type: 'boolean'
    },
    allow_multiple: {
      type: 'boolean'
    }
  }
};

const defaultLog = getLogger('paths/administrative/blueprints/properties/{assignmentId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateBlueprintFeatureTypeProperty()
];

PUT.apiDoc = {
  description: 'Update blueprint feature type property settings.',
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
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            requiredValue: {
              type: 'boolean'
            },
            allowMultiple: {
              type: 'boolean'
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Success',
      content: { 'application/json': { schema: BLUEPRINT_FEATURE_TYPE_PROPERTY_SCHEMA } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Update blueprint feature type property settings.
 *
 * @returns Authorized request handler.
 */
export function updateBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintCompositionService = new BlueprintCompositionService(connection);

      const response = await blueprintCompositionService.updateBlueprintFeatureTypeProperty(
        Number(req.params.blueprintId),
        Number(req.params.assignmentId),
        req.body
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'updateBlueprintFeatureTypeProperty',
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

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteBlueprintFeatureTypeProperty()
];

DELETE.apiDoc = {
  description: 'Delete a blueprint feature type property assignment.',
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
    200: {
      description: 'Success',
      content: { 'application/json': { schema: BLUEPRINT_FEATURE_TYPE_PROPERTY_SCHEMA } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Delete a blueprint feature type property assignment.
 *
 * @returns Authorized request handler.
 */
export function deleteBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintCompositionService = new BlueprintCompositionService(connection);

      const response = await blueprintCompositionService.deleteBlueprintFeatureTypeProperty(
        Number(req.params.blueprintId),
        Number(req.params.assignmentId)
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'deleteBlueprintFeatureTypeProperty',
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

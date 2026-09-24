import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { OpenAPIV3 } from 'openapi-types';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BlueprintCompositionService } from '../../../../../services/blueprint-composition-service';
import { BlueprintFeatureTypeService } from '../../../../../services/blueprint-feature-type-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../utils/pagination';

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

const defaultLog = getLogger('paths/administrative/blueprints/types');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBlueprintFeatureTypes()
];

GET.apiDoc = {
  description: 'List feature type assignments for the selected blueprint.',
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
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'keyword',
      schema: {
        type: 'string'
      }
    },
    {
      in: 'query',
      name: 'active',
      schema: {
        type: 'boolean'
      }
    }
  ],
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['types', 'pagination'],
            properties: {
              types: {
                type: 'array',
                items: BLUEPRINT_FEATURE_TYPE_SCHEMA
              },
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * List feature type assignments for the selected blueprint.
 *
 * @returns Authorized request handler.
 */
export function getBlueprintFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintFeatureTypeService = new BlueprintFeatureTypeService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const response = await blueprintFeatureTypeService.getBlueprintFeatureTypes(
        Number(req.params.blueprintId),
        { keyword: req.query.keyword as string | undefined, active: String(req.query.active) === 'true' },
        pagination
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'getBlueprintFeatureTypes',
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

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBlueprintFeatureType()
];

POST.apiDoc = {
  description: 'Assign an existing feature type to the selected blueprint.',
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
            featureTypeId: {
              type: 'integer',
              minimum: 1
            }
          },
          required: ['featureTypeId']
        }
      }
    }
  },
  responses: {
    201: { description: 'Success', content: { 'application/json': { schema: BLUEPRINT_FEATURE_TYPE_SCHEMA } } },
    ...defaultErrorResponses
  }
};

/**
 * Assign an existing feature type to the selected blueprint.
 *
 * @returns Authorized request handler.
 */
export function createBlueprintFeatureType(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintCompositionService = new BlueprintCompositionService(connection);

      const response = await blueprintCompositionService.createBlueprintFeatureType(
        Number(req.params.blueprintId),
        req.body
      );

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'createBlueprintFeatureType',
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { BlueprintFeaturePropertyAssignmentSchema } from '../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BlueprintCompositionService } from '../../../../../services/blueprint-composition-service';
import { BlueprintFeatureTypePropertyService } from '../../../../../services/blueprint-feature-type-property-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/blueprints/properties');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBlueprintFeatureTypeProperties()
];

GET.apiDoc = {
  description: 'List property assignments across the selected blueprint.',
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
    { in: 'query', name: 'blueprintFeatureTypeId', schema: { type: 'integer', minimum: 1 } },
    {
      in: 'query',
      name: 'keyword',
      schema: {
        type: 'string'
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
            required: ['properties', 'pagination'],
            properties: {
              properties: {
                type: 'array',
                items: BlueprintFeaturePropertyAssignmentSchema
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
 * List property assignments across the selected blueprint.
 *
 * @returns Authorized request handler.
 */
export function getBlueprintFeatureTypeProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintFeatureTypePropertyService = new BlueprintFeatureTypePropertyService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const response = await blueprintFeatureTypePropertyService.getBlueprintFeatureTypeProperties(
        Number(req.params.blueprintId),
        {
          keyword: req.query.keyword as string | undefined,
          blueprintFeatureTypeId:
            req.query.blueprintFeatureTypeId === undefined ? undefined : Number(req.query.blueprintFeatureTypeId)
        },
        pagination
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'getBlueprintFeatureTypeProperties',
        message: 'error',
        error
      });

      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBlueprintFeatureTypeProperty()
];

POST.apiDoc = {
  description: 'Assign an existing property to a blueprint feature type.',
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
            blueprintFeatureTypeId: {
              type: 'integer',
              minimum: 1
            },
            featurePropertyId: {
              type: 'integer',
              minimum: 1
            },
            requiredValue: {
              type: 'boolean'
            },
            allowMultiple: {
              type: 'boolean'
            }
          },
          required: ['blueprintFeatureTypeId', 'featurePropertyId']
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Success',
      content: { 'application/json': { schema: BlueprintFeaturePropertyAssignmentSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Assign an existing property to a blueprint feature type.
 *
 * @returns Authorized request handler.
 */
export function createBlueprintFeatureTypeProperty(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintCompositionService = new BlueprintCompositionService(connection);

      const response = await blueprintCompositionService.createBlueprintFeatureTypeProperty(
        Number(req.params.blueprintId),
        req.body
      );

      await connection.commit();

      return res.status(201).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'createBlueprintFeatureTypeProperty',
        message: 'error',
        error
      });

      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import {
  paginationRequestQueryParamSchema,
  paginationResponseSchema
} from '../../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BlueprintCompositionService } from '../../../../../../services/blueprint-composition-service';
import { getLogger } from '../../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/blueprints/types/available');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getAvailableFeatureTypesForBlueprint()
];

GET.apiDoc = {
  description: 'Search global feature types available to the selected blueprint.',
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
    }
  ],
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['options', 'pagination'],
            properties: {
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'name', 'display_name'],
                  properties: {
                    id: {
                      type: 'integer'
                    },
                    name: {
                      type: 'string'
                    },
                    display_name: {
                      type: 'string'
                    }
                  }
                }
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
 * Search global feature types available to the selected blueprint.
 *
 * @returns Authorized request handler.
 */
export function getAvailableFeatureTypesForBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintCompositionService = new BlueprintCompositionService(connection);
      const pagination = makePaginationOptionsFromRequest(req);
      const response = await blueprintCompositionService.getAvailableFeatureTypesForBlueprint(
        Number(req.params.blueprintId),
        req.query.keyword as string | undefined,
        pagination
      );

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({
        label: 'getAvailableFeatureTypesForBlueprint',
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

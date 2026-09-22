import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { AdminBlueprintSchema } from '../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../services/blueprint-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}');

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
  getBlueprint()
];

GET.apiDoc = {
  description: 'Get a blueprint by ID.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [blueprintIdParam],
  responses: {
    200: {
      description: 'Blueprint',
      content: {
        'application/json': {
          schema: AdminBlueprintSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a blueprint by ID.
 *
 * @returns {RequestHandler}
 */
export function getBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.getAdminBlueprint(blueprintId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getBlueprint', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

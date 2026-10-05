import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { PublishBlueprintRecord } from '../../../../../models/blueprint';
import { AdminBlueprintSchema, PublishBlueprintRequestSchema } from '../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../services/blueprint-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}/publish');

const blueprintIdParam = {
  in: 'path',
  name: 'blueprintId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Blueprint ID'
} as const;

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  publishBlueprint()
];

POST.apiDoc = {
  description:
    'Publish a draft blueprint, making it available for new uploads. Once published, a blueprint can no longer be changed. When published as the default, it replaces the current default blueprint.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [blueprintIdParam],
  requestBody: {
    required: false,
    content: {
      'application/json': {
        schema: PublishBlueprintRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Blueprint published',
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
 * Publish a draft blueprint.
 *
 * @returns {RequestHandler}
 */
export function publishBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const payload = (req.body ?? {}) as PublishBlueprintRecord;

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.publishBlueprint(blueprintId, payload);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'publishBlueprint', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

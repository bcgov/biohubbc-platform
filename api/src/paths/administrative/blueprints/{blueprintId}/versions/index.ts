import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { CreateBlueprintVersionRecord } from '../../../../../models/blueprint';
import { AdminBlueprintSchema, CreateBlueprintVersionRequestSchema } from '../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../services/blueprint-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}/versions');

const blueprintIdParam = {
  in: 'path',
  name: 'blueprintId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'ID of the blueprint to create the new version from'
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
  createBlueprintVersion()
];

POST.apiDoc = {
  description:
    'Create a new draft blueprint version from an existing blueprint. The active feature types and property assignments of the source blueprint are copied into new rows with their own identifiers; retired ones are not carried forward. The new version is not available for uploads until it is published.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [blueprintIdParam],
  requestBody: {
    required: false,
    content: {
      'application/json': {
        schema: CreateBlueprintVersionRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Draft blueprint version created',
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
 * Create a new draft blueprint version from an existing blueprint.
 *
 * @returns {RequestHandler}
 */
export function createBlueprintVersion(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const blueprintId = Number(req.params.blueprintId);
    const payload = (req.body ?? {}) as CreateBlueprintVersionRecord;

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const result = await blueprintService.createBlueprintVersion(blueprintId, payload);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createBlueprintVersion', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

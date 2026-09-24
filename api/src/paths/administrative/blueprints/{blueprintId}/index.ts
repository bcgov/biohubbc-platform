import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { BlueprintSchema, UpdateBlueprintRequestSchema } from '../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../services/blueprint-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBlueprint()
];

GET.apiDoc = {
  description: 'Retrieve blueprint metadata, including retired records.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'blueprintId', required: true, schema: { type: 'integer', minimum: 1 } }],

  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BlueprintSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Retrieve blueprint metadata, including retired records in one transaction.
 * @returns Authorized operation handler.
 */
export function getBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const blueprintService = new BlueprintService(connection);

      const result = await blueprintService.getBlueprint(Number(req.params.blueprintId));
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

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateBlueprint()
];

PUT.apiDoc = {
  description: 'Update supplied blueprint metadata.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'blueprintId', required: true, schema: { type: 'integer', minimum: 1 } }],
  requestBody: { required: true, content: { 'application/json': { schema: UpdateBlueprintRequestSchema } } },
  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BlueprintSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Update supplied blueprint metadata in one transaction.
 * @returns Authorized operation handler.
 */
export function updateBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const blueprintService = new BlueprintService(connection);

      const result = await blueprintService.updateBlueprint(Number(req.params.blueprintId), req.body);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'updateBlueprint', message: 'error', error });
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
  retireBlueprint()
];

DELETE.apiDoc = {
  description: 'Retire a blueprint while preserving its references.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'blueprintId', required: true, schema: { type: 'integer', minimum: 1 } }],

  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BlueprintSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Retire a blueprint while preserving its references in one transaction.
 * @returns Authorized operation handler.
 */
export function retireBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const blueprintService = new BlueprintService(connection);

      const result = await blueprintService.retireBlueprint(Number(req.params.blueprintId));
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'retireBlueprint', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

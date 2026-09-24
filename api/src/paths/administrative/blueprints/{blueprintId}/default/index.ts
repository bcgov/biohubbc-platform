import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { BlueprintSchema } from '../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../../../services/blueprint-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/blueprints/{blueprintId}/default');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  setDefaultBlueprint()
];

PUT.apiDoc = {
  description: 'Make an effective blueprint the default.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'blueprintId', required: true, schema: { type: 'integer', minimum: 1 } }],

  responses: {
    200: { description: 'Success', content: { 'application/json': { schema: BlueprintSchema } } },
    ...defaultErrorResponses
  }
};

/**
 * Make an effective blueprint the default in one transaction.
 * @returns Authorized operation handler.
 */
export function setDefaultBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const blueprintService = new BlueprintService(connection);

      const result = await blueprintService.setDefaultBlueprint(Number(req.params.blueprintId));
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'setDefaultBlueprint', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

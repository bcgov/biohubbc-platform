import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { BlueprintsListResponseSchema } from '../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../services/blueprint-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/blueprints');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getBlueprints()
];

GET.apiDoc = {
  description: 'Get all active blueprints, newest version first. Includes drafts.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [...paginationRequestQueryParamSchema],
  responses: {
    200: {
      description: 'List of active blueprints',
      content: {
        'application/json': {
          schema: BlueprintsListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all active blueprints.
 *
 * @returns {RequestHandler}
 */
export function getBlueprints(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const blueprintService = new BlueprintService(connection);
      const pagination = makePaginationOptionsFromRequest(req);

      const [blueprints, count] = await Promise.all([
        blueprintService.getAdminBlueprints(pagination),
        blueprintService.getAdminBlueprintsCount()
      ]);

      await connection.commit();

      return res.status(200).json({ blueprints, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getBlueprints', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

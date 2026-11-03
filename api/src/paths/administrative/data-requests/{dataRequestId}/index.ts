import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { DataRequestListItemSchema } from '../../../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../../services/data-request-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/data-requests/{dataRequestId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getDataRequest()
];

GET.apiDoc = {
  description: 'Get a data request by ID, with its decision and the user who submitted it.',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'dataRequestId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Data request ID'
    }
  ],
  responses: {
    200: {
      description: 'Data request',
      content: {
        'application/json': {
          schema: DataRequestListItemSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a data request by ID, with its decision and the user who submitted it.
 *
 * @returns {RequestHandler}
 */
export function getDataRequest(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const dataRequestId = req.params.dataRequestId;

    try {
      await connection.open();

      const dataRequestService = new DataRequestService(connection);
      const dataRequest = await dataRequestService.getDataRequestListItem(dataRequestId);

      await connection.commit();

      return res.status(200).json(dataRequest);
    } catch (error) {
      defaultLog.error({ label: 'getDataRequest', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

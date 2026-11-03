import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { DataRequestRecipientsResponseSchema } from '../../../../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../../../services/data-request-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/data-requests/{dataRequestId}/recipients');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getDataRequestRecipients()
];

GET.apiDoc = {
  description: 'Get the recipients of a data request: the members of the team its policy is assigned to.',
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
      description: 'Data request recipients',
      content: {
        'application/json': {
          schema: DataRequestRecipientsResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get the recipients of a data request: the members of the team its policy is assigned to.
 *
 * @returns {RequestHandler}
 */
export function getDataRequestRecipients(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const dataRequestId = req.params.dataRequestId;

    try {
      await connection.open();

      const dataRequestService = new DataRequestService(connection);
      const recipients = await dataRequestService.getDataRequestRecipients(dataRequestId);

      await connection.commit();

      return res.status(200).json({ recipients });
    } catch (error) {
      defaultLog.error({ label: 'getDataRequestRecipients', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

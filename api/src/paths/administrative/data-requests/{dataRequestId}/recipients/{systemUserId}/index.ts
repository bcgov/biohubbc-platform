import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../../../../services/data-request-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/data-requests/{dataRequestId}/recipients/{systemUserId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  deleteDataRequestRecipient()
];

DELETE.apiDoc = {
  description:
    'Remove a recipient from a data request by ending their membership of the team its policy is assigned to. Removing a user who is not a recipient succeeds without change.',
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
    },
    {
      in: 'path',
      name: 'systemUserId',
      required: true,
      schema: {
        type: 'integer',
        minimum: 1
      },
      description: 'System user ID of the recipient to remove'
    }
  ],
  responses: {
    204: {
      description: 'Recipient removed'
    },
    ...defaultErrorResponses
  }
};

/**
 * Remove a recipient from a data request.
 *
 * @returns {RequestHandler}
 */
export function deleteDataRequestRecipient(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const dataRequestId = req.params.dataRequestId;
    const systemUserId = Number(req.params.systemUserId);

    try {
      await connection.open();

      const dataRequestService = new DataRequestService(connection);
      await dataRequestService.deleteDataRequestRecipient(dataRequestId, systemUserId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteDataRequestRecipient', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { CreateDataRequestRequestSchema, DataRequestResponseSchema } from '../../../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../../services/data-request-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/data-request');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTicketDataRequest()
];

POST.apiDoc = {
  description: 'Create a new ticket-owned data request',
  tags: ['tickets'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Ticket UUID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateDataRequestRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Data request created successfully',
      content: {
        'application/json': {
          schema: DataRequestResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function createTicketDataRequest(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { reason, system_user_ids } = req.body;
      const { ticketId } = req.params;

      const dataRequestService = new DataRequestService(connection);

      const dataRequest = await dataRequestService.createDataRequest({
        requested_by: systemUserId,
        reason,
        ticket_id: ticketId,
        system_user_ids
      });

      await connection.commit();

      return res.status(201).json(dataRequest);
    } catch (error) {
      defaultLog.error({ label: 'createTicketDataRequest', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

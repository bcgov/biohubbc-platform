import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { TicketWithHistorySchema } from '../../../openapi/schemas/ticket';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TicketService } from '../../../services/ticket-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tickets/{ticketId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'SystemUser' }]
  })),
  getTicketForUser()
];

GET.apiDoc = {
  description: 'Get ticket details by ticket ID',
  tags: ['tickets'],
  security: [
    {
      Bearer: []
    }
  ],
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
  responses: {
    200: {
      description: 'Ticket retrieved successfully',
      content: {
        'application/json': {
          schema: TicketWithHistorySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getTicketForUser(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const ticket = await ticketService.getTicket(req.params.ticketId);

      await connection.commit();

      return res.status(200).json(ticket);
    } catch (error) {
      defaultLog.error({ label: 'getTicket', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

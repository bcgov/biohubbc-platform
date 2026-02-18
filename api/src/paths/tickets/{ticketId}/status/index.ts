import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TicketSchema, UpdateTicketStatusRequestSchema } from '../../../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TicketService } from '../../../../services/ticket-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}/status');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateTicketStatus()
];

POST.apiDoc = {
  description: 'Change the status of a ticket',
  tags: ['tickets'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: {
        type: 'string'
      },
      description: 'Ticket UUID or 8-digit short ID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: UpdateTicketStatusRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Ticket status updated successfully',
      content: {
        'application/json': {
          schema: TicketSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function updateTicketStatus(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const ticket = await ticketService.updateTicket(req.params.ticketId, { status: req.body.status });

      await connection.commit();

      return res.status(200).json(ticket);
    } catch (error) {
      defaultLog.error({ label: 'updateTicketStatus', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { TicketSchema, TicketWithHistorySchema, UpdateTicketRequestSchema } from '../../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TicketService } from '../../../services/ticket-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/tickets/{ticketId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTicket()
];
export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  patchTicket()
];

GET.apiDoc = {
  description: 'Get ticket details by ticket ID',
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
      }
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

PATCH.apiDoc = {
  description: 'Update ticket fields excluding status',
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
      }
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: UpdateTicketRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Ticket updated successfully',
      content: {
        'application/json': {
          schema: TicketSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getTicket(): RequestHandler {
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

export function patchTicket(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const ticket = await ticketService.updateTicket(req.params.ticketId, req.body);

      await connection.commit();

      return res.status(200).json(ticket);
    } catch (error) {
      defaultLog.error({ label: 'patchTicket', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

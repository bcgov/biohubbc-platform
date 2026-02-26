import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../openapi/schemas/pagination';
import { CreateTicketRequestSchema, TicketListResponseSchema, TicketSchema } from '../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { TicketService } from '../../services/ticket-service';
import { getLogger } from '../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../utils/pagination';

const defaultLog = getLogger('paths/tickets');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  createTicket()
];
export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getTickets()
];

POST.apiDoc = {
  description: 'Create a ticket',
  tags: ['tickets'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateTicketRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Ticket created successfully',
      content: {
        'application/json': {
          schema: TicketSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

GET.apiDoc = {
  description: 'List tickets by team ID, optionally filtered by status',
  tags: ['tickets'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'team_id',
      required: false,
      schema: {
        type: 'string',
        format: 'uuid'
      },
      description: 'Optional team filter. If omitted, returns tickets across all teams.'
    },
    {
      in: 'query',
      name: 'status',
      required: false,
      schema: {
        type: 'string',
        enum: ['open', 'closed']
      }
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Tickets retrieved successfully',
      content: {
        'application/json': {
          schema: TicketListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function createTicket(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const ticket = await ticketService.createTicket(req.body);

      await connection.commit();

      return res.status(201).json(ticket);
    } catch (error) {
      defaultLog.error({ label: 'createTicket', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export function getTickets(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const ticketService = new TicketService(connection);
      const teamId = (req.query.team_id as string | undefined) ?? '';
      const status = req.query.status as 'open' | 'closed' | undefined;
      const pagination = makePaginationOptionsFromRequest(req);
      const filters = { status };

      const [tickets, count] = await Promise.all([
        ticketService.getTicketsByTeamId(teamId, filters, ensureCompletePaginationOptions(pagination)),
        ticketService.getTicketsByTeamIdCount(teamId, filters)
      ]);

      await connection.commit();

      return res.status(200).json({
        tickets,
        pagination: makePaginationResponse(count, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getTickets', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

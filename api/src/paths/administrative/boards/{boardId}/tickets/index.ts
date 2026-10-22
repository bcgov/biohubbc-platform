import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { BoardTicketsResponseSchema } from '../../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { CreateTicketRequestSchema, TicketSchema } from '../../../../../openapi/schemas/ticket';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BoardService } from '../../../../../services/board-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/tickets');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBoardTickets()
];

GET.apiDoc = {
  description:
    'Get every ticket on a board, and the tickets grouped into its swimlanes, hidden ones included. Each ticket is in exactly one swimlane.',
  tags: ['boards'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'boardId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Board UUID.'
    },
    {
      in: 'query',
      name: 'include_closed',
      required: false,
      schema: { type: 'boolean', default: false },
      description: 'Include closed tickets. Defaults to open tickets only.'
    }
  ],
  responses: {
    200: {
      description: 'Board tickets retrieved successfully',
      content: { 'application/json': { schema: BoardTicketsResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBoardTicket()
];

POST.apiDoc = {
  description:
    "Create a ticket on a board, in the board's default swimlane: its first, which is To Do unless the swimlanes were reordered.",
  tags: ['boards', 'tickets'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'boardId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Board UUID.'
    }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: CreateTicketRequestSchema } }
  },
  responses: {
    201: {
      description: 'Ticket created successfully',
      content: { 'application/json': { schema: TicketSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get the tickets on a board grouped by swimlane.
 *
 * @returns {RequestHandler}
 */
export function getBoardTickets(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const includeClosed = String(req.query.include_closed) === 'true';
      const boardTickets = await boardService.getBoardTickets(req.params.boardId, { include_closed: includeClosed });

      await connection.commit();

      return res.status(200).json(boardTickets);
    } catch (error) {
      defaultLog.error({ label: 'getBoardTickets', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Create a ticket on a board.
 *
 * @returns {RequestHandler}
 */
export function createBoardTicket(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const ticket = await boardService.createBoardTicket(req.params.boardId, req.body);

      await connection.commit();

      return res.status(201).json(ticket);
    } catch (error) {
      defaultLog.error({ label: 'createBoardTicket', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { BoardTicketRequestSchema } from '../../../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BoardService } from '../../../../../../services/board-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/tickets/{ticketId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  ensureBoardTicket()
];

PUT.apiDoc = {
  description:
    "Put a ticket on a board, or move it to another of the board's swimlanes. Without a swimlane, a ticket not on the board is put in its default swimlane, and a ticket on it stays in its swimlane. A ticket is in one swimlane per board.",
  tags: ['boards', 'tickets'],
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
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Ticket UUID.'
    }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: BoardTicketRequestSchema } }
  },
  responses: {
    204: { description: 'Ticket placed successfully' },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteBoardTicket()
];

DELETE.apiDoc = {
  description: 'Take a ticket off a board. The ticket itself is not affected.',
  tags: ['boards', 'tickets'],
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
      in: 'path',
      name: 'ticketId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Ticket UUID.'
    }
  ],
  responses: {
    204: { description: 'Ticket taken off the board successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Put a ticket on a board, or move it to another swimlane.
 *
 * @returns {RequestHandler}
 */
export function ensureBoardTicket(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      await boardService.ensureBoardTicket(req.params.boardId, req.params.ticketId, req.body);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'ensureBoardTicket', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Take a ticket off a board.
 *
 * @returns {RequestHandler}
 */
export function deleteBoardTicket(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      await boardService.deleteBoardTicket(req.params.boardId, req.params.ticketId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteBoardTicket', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

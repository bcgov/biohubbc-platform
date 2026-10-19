import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { BoardTicketsResponseSchema } from '../../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
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
    'Get the tickets on a board grouped into its visible swimlanes. Tickets matching no lane are returned as unsorted; tickets placed in hidden lanes are omitted and counted.',
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
      connection.release();
    }
  };
}

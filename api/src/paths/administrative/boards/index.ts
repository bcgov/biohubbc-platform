import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { BoardDetailSchema, BoardListResponseSchema, BoardRequestSchema } from '../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { BoardService } from '../../../services/board-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBoards()
];

GET.apiDoc = {
  description: 'List active ticket boards with their tags and swimlane count.',
  tags: ['boards'],
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Boards retrieved successfully',
      content: { 'application/json': { schema: BoardListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBoard()
];

POST.apiDoc = {
  description: 'Create a ticket board with its tags.',
  tags: ['boards'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: BoardRequestSchema } }
  },
  responses: {
    201: {
      description: 'Board created successfully',
      content: { 'application/json': { schema: BoardDetailSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List active boards.
 *
 * @returns {RequestHandler}
 */
export function getBoards(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const boards = await boardService.getBoards();

      await connection.commit();

      return res.status(200).json({ boards });
    } catch (error) {
      defaultLog.error({ label: 'getBoards', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Create a board.
 *
 * @returns {RequestHandler}
 */
export function createBoard(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const board = await boardService.createBoard(req.body);

      await connection.commit();

      return res.status(201).json(board);
    } catch (error) {
      defaultLog.error({ label: 'createBoard', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { BoardDetailSchema, BoardRequestSchema } from '../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { BoardService } from '../../../../services/board-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getBoard()
];

GET.apiDoc = {
  description: 'Get a ticket board configuration: tags and swimlanes (with tags, sort order, and visibility).',
  tags: ['boards'],
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
  responses: {
    200: {
      description: 'Board retrieved successfully',
      content: { 'application/json': { schema: BoardDetailSchema } }
    },
    ...defaultErrorResponses
  }
};

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateBoard()
];

PUT.apiDoc = {
  description: 'Update a ticket board and replace its tag set.',
  tags: ['boards'],
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
    content: { 'application/json': { schema: BoardRequestSchema } }
  },
  responses: {
    200: {
      description: 'Board updated successfully',
      content: { 'application/json': { schema: BoardDetailSchema } }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteBoard()
];

DELETE.apiDoc = {
  description: 'Delete a ticket board with its tag links, swimlanes, and swimlane tag links.',
  tags: ['boards'],
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
  responses: {
    204: { description: 'Board deleted successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Get a board configuration.
 *
 * @returns {RequestHandler}
 */
export function getBoard(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const board = await boardService.getBoard(req.params.boardId);

      await connection.commit();

      return res.status(200).json(board);
    } catch (error) {
      defaultLog.error({ label: 'getBoard', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Update a board.
 *
 * @returns {RequestHandler}
 */
export function updateBoard(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const board = await boardService.updateBoard(req.params.boardId, req.body);

      await connection.commit();

      return res.status(200).json(board);
    } catch (error) {
      defaultLog.error({ label: 'updateBoard', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Delete a board.
 *
 * @returns {RequestHandler}
 */
export function deleteBoard(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      await boardService.deleteBoard(req.params.boardId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteBoard', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

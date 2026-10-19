import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import {
  BoardSwimlaneListResponseSchema,
  ReorderBoardSwimlanesRequestSchema
} from '../../../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BoardSwimlaneService } from '../../../../../../services/board-swimlane-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/swimlanes/order');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  reorderBoardSwimlanes()
];

PUT.apiDoc = {
  description:
    'Set the left-to-right order of a board swimlanes. The body must list every active swimlane of the board exactly once.',
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
    content: { 'application/json': { schema: ReorderBoardSwimlanesRequestSchema } }
  },
  responses: {
    200: {
      description: 'Swimlanes reordered successfully',
      content: { 'application/json': { schema: BoardSwimlaneListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Reorder a board's swimlanes.
 *
 * @returns {RequestHandler}
 */
export function reorderBoardSwimlanes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardSwimlaneService = new BoardSwimlaneService(connection);
      const swimlanes = await boardSwimlaneService.reorderBoardSwimlanes(req.params.boardId, req.body.swimlaneIds);

      await connection.commit();

      return res.status(200).json({ swimlanes });
    } catch (error) {
      defaultLog.error({ label: 'reorderBoardSwimlanes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

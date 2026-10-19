import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { BoardSwimlaneRequestSchema, BoardSwimlaneSchema } from '../../../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BoardSwimlaneService } from '../../../../../../services/board-swimlane-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/swimlanes/{swimlaneId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateBoardSwimlane()
];

PUT.apiDoc = {
  description: 'Update a board swimlane and replace its tag set. The swimlane must belong to the board.',
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
      in: 'path',
      name: 'swimlaneId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Board swimlane UUID.'
    }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: BoardSwimlaneRequestSchema } }
  },
  responses: {
    200: {
      description: 'Swimlane updated successfully',
      content: { 'application/json': { schema: BoardSwimlaneSchema } }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteBoardSwimlane()
];

DELETE.apiDoc = {
  description: 'Delete a board swimlane and its tag links. The swimlane must belong to the board.',
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
      in: 'path',
      name: 'swimlaneId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Board swimlane UUID.'
    }
  ],
  responses: {
    204: { description: 'Swimlane deleted successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Update a board swimlane.
 *
 * @returns {RequestHandler}
 */
export function updateBoardSwimlane(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardSwimlaneService = new BoardSwimlaneService(connection);
      const swimlane = await boardSwimlaneService.updateBoardSwimlane(
        req.params.boardId,
        req.params.swimlaneId,
        req.body
      );

      await connection.commit();

      return res.status(200).json(swimlane);
    } catch (error) {
      defaultLog.error({ label: 'updateBoardSwimlane', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Delete a board swimlane.
 *
 * @returns {RequestHandler}
 */
export function deleteBoardSwimlane(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardSwimlaneService = new BoardSwimlaneService(connection);
      await boardSwimlaneService.deleteBoardSwimlane(req.params.boardId, req.params.swimlaneId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteBoardSwimlane', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

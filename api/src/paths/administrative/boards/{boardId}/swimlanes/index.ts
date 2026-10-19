import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { BoardSwimlaneRequestSchema, BoardSwimlaneSchema } from '../../../../../openapi/schemas/board';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BoardSwimlaneService } from '../../../../../services/board-swimlane-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/swimlanes');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBoardSwimlane()
];

POST.apiDoc = {
  description: 'Create a swimlane at the end of a ticket board.',
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
    content: { 'application/json': { schema: BoardSwimlaneRequestSchema } }
  },
  responses: {
    201: {
      description: 'Swimlane created successfully',
      content: { 'application/json': { schema: BoardSwimlaneSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a board swimlane.
 *
 * @returns {RequestHandler}
 */
export function createBoardSwimlane(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardSwimlaneService = new BoardSwimlaneService(connection);
      const swimlane = await boardSwimlaneService.createBoardSwimlane(req.params.boardId, req.body);

      await connection.commit();

      return res.status(201).json(swimlane);
    } catch (error) {
      defaultLog.error({ label: 'createBoardSwimlane', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

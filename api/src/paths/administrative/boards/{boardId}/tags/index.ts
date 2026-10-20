import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { TagRequestSchema, TagSchema } from '../../../../../openapi/schemas/tag';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { BoardService } from '../../../../../services/board-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/tags');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createBoardTag()
];

POST.apiDoc = {
  description:
    'Create a ticket tag and add it to a board. The tag is a regular tag, available to every ticket and board.',
  tags: ['boards', 'tags'],
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
    content: { 'application/json': { schema: TagRequestSchema } }
  },
  responses: {
    201: {
      description: 'Tag created and added to the board successfully',
      content: { 'application/json': { schema: TagSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Create a tag and add it to a board.
 *
 * @returns {RequestHandler}
 */
export function createBoardTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      const tag = await boardService.createBoardTag(req.params.boardId, req.body);

      await connection.commit();

      return res.status(201).json(tag);
    } catch (error) {
      defaultLog.error({ label: 'createBoardTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

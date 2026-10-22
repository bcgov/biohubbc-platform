import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { BoardService } from '../../../../../../services/board-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/boards/{boardId}/tags/{tagId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  ensureBoardTag()
];

PUT.apiDoc = {
  description:
    "Link an existing tag to a board, so applying it to a ticket puts the ticket in the board's default swimlane. Tickets that already have the tag are put there too; linking a linked tag changes nothing.",
  tags: ['boards', 'tags'],
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
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    }
  ],
  responses: {
    204: { description: 'Tag linked to the board successfully' },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteBoardTag()
];

DELETE.apiDoc = {
  description: "Unlink a tag from a board. The tag, and the board's tickets, are not affected.",
  tags: ['boards', 'tags'],
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
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    }
  ],
  responses: {
    204: { description: 'Tag unlinked from the board successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Link an existing tag to a board.
 *
 * @returns {RequestHandler}
 */
export function ensureBoardTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      await boardService.ensureBoardTag(req.params.boardId, req.params.tagId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'ensureBoardTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Unlink a tag from a board.
 *
 * @returns {RequestHandler}
 */
export function deleteBoardTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const boardService = new BoardService(connection);
      await boardService.deleteBoardTag(req.params.boardId, req.params.tagId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteBoardTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

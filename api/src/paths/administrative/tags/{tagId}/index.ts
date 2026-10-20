import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { TagRequestSchema, TagSchema } from '../../../../openapi/schemas/tag';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { TagService } from '../../../../services/tag-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tags/{tagId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTag()
];

GET.apiDoc = {
  description: 'Get a ticket tag.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    }
  ],
  responses: {
    200: {
      description: 'Tag retrieved successfully',
      content: { 'application/json': { schema: TagSchema } }
    },
    ...defaultErrorResponses
  }
};

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateTag()
];

PUT.apiDoc = {
  description: 'Update a ticket tag name, description, and color.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: TagRequestSchema } }
  },
  responses: {
    200: {
      description: 'Tag updated successfully',
      content: { 'application/json': { schema: TagSchema } }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteTag()
];

DELETE.apiDoc = {
  description: 'Delete a ticket tag and remove it from all tickets, boards, and board swimlanes.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    }
  ],
  responses: {
    204: { description: 'Tag deleted successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Get a tag.
 *
 * @returns {RequestHandler}
 */
export function getTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagService = new TagService(connection);
      const tag = await tagService.getTag(req.params.tagId);

      await connection.commit();

      return res.status(200).json(tag);
    } catch (error) {
      defaultLog.error({ label: 'getTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Update a tag.
 *
 * @returns {RequestHandler}
 */
export function updateTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagService = new TagService(connection);
      const tag = await tagService.updateTag(req.params.tagId, req.body);

      await connection.commit();

      return res.status(200).json(tag);
    } catch (error) {
      defaultLog.error({ label: 'updateTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Delete a tag and its ticket, board, and swimlane links.
 *
 * @returns {RequestHandler}
 */
export function deleteTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagService = new TagService(connection);
      await tagService.deleteTag(req.params.tagId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { TagListResponseSchema, TagRequestSchema, TagSchema } from '../../../openapi/schemas/tag';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TagService } from '../../../services/tag-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tags');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTags()
];

GET.apiDoc = {
  description: 'List active ticket tags, optionally filtered by name.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Optional case-insensitive search on tag name.'
    }
  ],
  responses: {
    200: {
      description: 'Tags retrieved successfully',
      content: { 'application/json': { schema: TagListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createTag()
];

POST.apiDoc = {
  description: 'Create a ticket tag.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: TagRequestSchema } }
  },
  responses: {
    201: {
      description: 'Tag created successfully',
      content: { 'application/json': { schema: TagSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List active tags.
 *
 * @returns {RequestHandler}
 */
export function getTags(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagService = new TagService(connection);
      const search = req.query.search as string | undefined;
      const tags = await tagService.getTags({ search });

      await connection.commit();

      return res.status(200).json({ tags });
    } catch (error) {
      defaultLog.error({ label: 'getTags', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Create a tag.
 *
 * @returns {RequestHandler}
 */
export function createTag(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagService = new TagService(connection);
      const tag = await tagService.createTag(req.body);

      await connection.commit();

      return res.status(201).json(tag);
    } catch (error) {
      defaultLog.error({ label: 'createTag', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

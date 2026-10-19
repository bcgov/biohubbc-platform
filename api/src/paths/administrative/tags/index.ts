import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { TagFilters } from '../../../models/tag';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { TagListResponseSchema, TagRequestSchema, TagSchema } from '../../../openapi/schemas/tag';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TagService } from '../../../services/tag-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/tags');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTags()
];

GET.apiDoc = {
  description: 'List active ticket tags, optionally filtered by name or board.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Optional case-insensitive search on tag name.'
    },
    {
      in: 'query',
      name: 'board_id',
      required: false,
      schema: { type: 'string', format: 'uuid' },
      description: 'Optional board filter: only the tags on this board.'
    },
    ...paginationRequestQueryParamSchema
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
      const filters: TagFilters = {
        search: req.query.search as string | undefined,
        board_id: req.query.board_id as string | undefined
      };
      const pagination = makePaginationOptionsFromRequest(req);

      const [tags, count] = await Promise.all([
        tagService.getTags(filters, pagination),
        tagService.getTagsCount(filters)
      ]);

      await connection.commit();

      return res.status(200).json({ tags, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getTags', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
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
      await connection.release();
    }
  };
}

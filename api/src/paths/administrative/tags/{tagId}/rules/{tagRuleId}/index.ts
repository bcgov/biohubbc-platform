import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { TagRuleDetailSchema, TagRuleRequestSchema } from '../../../../../../openapi/schemas/tag-rule';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { TagRuleService } from '../../../../../../services/tag-rule-service';
import { getLogger } from '../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tags/{tagId}/rules/{tagRuleId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTagRule()
];

GET.apiDoc = {
  description: 'Get a rule of a tag with its expression.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    },
    {
      in: 'path',
      name: 'tagRuleId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag rule UUID.'
    }
  ],
  responses: {
    200: {
      description: 'Tag rule retrieved successfully',
      content: { 'application/json': { schema: TagRuleDetailSchema } }
    },
    ...defaultErrorResponses
  }
};

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateTagRule()
];

PUT.apiDoc = {
  description:
    "Update a tag rule's name, description and expression. Changes apply to tickets evaluated afterwards; tags already applied are unaffected.",
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    },
    {
      in: 'path',
      name: 'tagRuleId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag rule UUID.'
    }
  ],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: TagRuleRequestSchema } }
  },
  responses: {
    200: {
      description: 'Tag rule updated successfully',
      content: { 'application/json': { schema: TagRuleDetailSchema } }
    },
    ...defaultErrorResponses
  }
};

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteTagRule()
];

DELETE.apiDoc = {
  description: 'Delete a tag rule, optionally removing the tags it applied.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'tagId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag UUID.'
    },
    {
      in: 'path',
      name: 'tagRuleId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Tag rule UUID.'
    },
    {
      in: 'query',
      name: 'remove_tags',
      required: false,
      schema: { type: 'boolean', default: false },
      description: 'Remove the tags the rule applied from all tickets.'
    }
  ],
  responses: {
    204: { description: 'Tag rule deleted successfully' },
    ...defaultErrorResponses
  }
};

/**
 * Get a rule of a tag.
 *
 * @returns {RequestHandler}
 */
export function getTagRule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const tagRule = await tagRuleService.getTagRule(req.params.tagId, req.params.tagRuleId);

      await connection.commit();

      return res.status(200).json(tagRule);
    } catch (error) {
      defaultLog.error({ label: 'getTagRule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Update a rule of a tag.
 *
 * @returns {RequestHandler}
 */
export function updateTagRule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const tagRule = await tagRuleService.updateTagRule(req.params.tagId, req.params.tagRuleId, req.body);

      await connection.commit();

      return res.status(200).json(tagRule);
    } catch (error) {
      defaultLog.error({ label: 'updateTagRule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Delete a rule of a tag.
 *
 * @returns {RequestHandler}
 */
export function deleteTagRule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const removeTags = String(req.query.remove_tags) === 'true';
      await tagRuleService.deleteTagRule(req.params.tagId, req.params.tagRuleId, removeTags);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteTagRule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../openapi/schemas/pagination';
import {
  TagRuleDetailSchema,
  TagRuleListResponseSchema,
  TagRuleRequestSchema
} from '../../../../../openapi/schemas/tag-rule';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { TagRuleService } from '../../../../../services/tag-rule-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/tags/{tagId}/rules');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTagRules()
];

GET.apiDoc = {
  description: "List a tag's rules.",
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
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Tag rules retrieved successfully',
      content: { 'application/json': { schema: TagRuleListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createTagRule()
];

POST.apiDoc = {
  description:
    'Create an enabled rule for a tag. It applies to tickets evaluated after it is created; existing tickets are not re-evaluated.',
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
    content: { 'application/json': { schema: TagRuleRequestSchema } }
  },
  responses: {
    201: {
      description: 'Tag rule created successfully',
      content: { 'application/json': { schema: TagRuleDetailSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * List a tag's rules.
 *
 * @returns {RequestHandler}
 */
export function getTagRules(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const pagination = makePaginationOptionsFromRequest(req);

      const [tagRules, count] = await Promise.all([
        tagRuleService.getTagRules(req.params.tagId, pagination),
        tagRuleService.getTagRulesCount(req.params.tagId)
      ]);

      await connection.commit();

      return res.status(200).json({ tag_rules: tagRules, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getTagRules', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/**
 * Create a rule for a tag.
 *
 * @returns {RequestHandler}
 */
export function createTagRule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const tagRule = await tagRuleService.createTagRule(req.params.tagId, req.body);

      await connection.commit();

      return res.status(201).json(tagRule);
    } catch (error) {
      defaultLog.error({ label: 'createTagRule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

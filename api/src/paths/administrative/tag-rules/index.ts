import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import {
  TagRuleDetailSchema,
  TagRuleListResponseSchema,
  TagRuleRequestSchema
} from '../../../openapi/schemas/tag-rule';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { TagRuleService } from '../../../services/tag-rule-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tag-rules');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getTagRules()
];

GET.apiDoc = {
  description: 'List active tag rules.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
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
  description: 'Create a tag rule. Enabled rules are evaluated against every active ticket in the background.',
  tags: ['tags'],
  security: [{ Bearer: [] }],
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
 * List active tag rules.
 *
 * @returns {RequestHandler}
 */
export function getTagRules(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const tagRules = await tagRuleService.getTagRules();

      await connection.commit();

      return res.status(200).json({ tag_rules: tagRules });
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
 * Create a tag rule.
 *
 * @returns {RequestHandler}
 */
export function createTagRule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const tagRule = await tagRuleService.createTagRule(req.body);

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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { TagRuleEnabledRequestSchema, TagRuleSchema } from '../../../../../../../openapi/schemas/tag-rule';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { TagRuleService } from '../../../../../../../services/tag-rule-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/tags/{tagId}/rules/{tagRuleId}/enabled');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateTagRuleEnabled()
];

PUT.apiDoc = {
  description: 'Enable or disable a tag rule. Disabled rules are not evaluated; tags already applied are unaffected.',
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
    content: { 'application/json': { schema: TagRuleEnabledRequestSchema } }
  },
  responses: {
    200: {
      description: 'Tag rule updated successfully',
      content: { 'application/json': { schema: TagRuleSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Enable or disable a rule of a tag.
 *
 * @returns {RequestHandler}
 */
export function updateTagRuleEnabled(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const tagRuleService = new TagRuleService(connection);
      const tagRule = await tagRuleService.updateTagRuleEnabled(
        req.params.tagId,
        req.params.tagRuleId,
        req.body.isEnabled
      );

      await connection.commit();

      return res.status(200).json(tagRule);
    } catch (error) {
      defaultLog.error({ label: 'updateTagRuleEnabled', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

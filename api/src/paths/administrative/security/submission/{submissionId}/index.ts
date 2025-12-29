import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SubmissionFeatureSecuritySummarySchema } from '../../../../../openapi/schemas/security';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SecurityService } from '../../../../../services/security-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/security/submission/{submissionId}');

/**
 * GET all security rules applied to a submission.
 */
export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getSubmissionFeatureSecuritySummary()
];

GET.apiDoc = {
  description: 'Get all security rules applied to all features of a submission.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'integer', minimum: 1 },
      required: true
    },
    {
      description: 'Submission Feature IDs to get rules for',
      in: 'query',
      name: 'submissionFeatureIds',
      schema: { type: 'array', items: { type: 'number' } }
    }
  ],
  responses: {
    200: {
      description: 'Security rules for all submission features',
      content: {
        'application/json': {
          schema: SubmissionFeatureSecuritySummarySchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getSubmissionFeatureSecuritySummary(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const securityService = new SecurityService(connection);

    try {
      await connection.open();

      const submissionId = Number(req.params.submissionId);
      const submissionFeatureIds = (req.query?.submissionFeatureIds as string[] | undefined)?.map(Number);

      const rules = await securityService.getSubmissionFeatureSecuritySummary(submissionId, submissionFeatureIds);

      await connection.commit();
      return res.status(200).json(rules);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatureSecuritySummary', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * PATCH: Apply security rules to the entire submission.
 */
export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  patchSecurityRulesOnSubmission()
];

PATCH.apiDoc = {
  description: 'Applies security to all features of a submission.',
  tags: ['security'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'integer', minimum: 1 },
      required: true
    }
  ],
  requestBody: {
    description: 'Payload of submission features and rules to apply.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['applyRuleIds', 'removeRuleIds'],
          properties: {
            applyRuleIds: {
              type: 'array',
              items: {
                type: 'integer'
              }
            },
            removeRuleIds: {
              type: 'array',
              items: {
                type: 'integer'
              }
            }
          }
        }
      }
    }
  },
  responses: {
    204: { description: 'Security successfully applied to submission.' },
    ...defaultErrorResponses
  }
};

export function patchSecurityRulesOnSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const securityService = new SecurityService(connection);

    const submissionId = Number(req.params.submissionId);
    const applyRuleIds: number[] = req.body.applyRuleIds;
    const removeRuleIds: number[] = req.body.removeRuleIds;

    try {
      await connection.open();

      // Apply security to the entire submission
      await securityService.patchSecurityRulesOnSubmission(submissionId, applyRuleIds, removeRuleIds);

      await connection.commit();
      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'patchSecurityRulesOnSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

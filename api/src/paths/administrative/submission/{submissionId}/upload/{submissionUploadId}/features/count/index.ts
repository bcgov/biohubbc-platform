import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import {
  featureSearchCountResponseSchema,
  featureSearchExpressionTreeSchema
} from '../../../../../../../../openapi/schemas/search/search-feature';
import { submissionUploadParameters } from '../../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../../services/search-feature-service';
import { validateSearchExpressionTree } from '../../../../../../../../utils/search-feature-validation';

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  countSubmissionUploadFeatures()
];

POST.apiDoc = {
  description: 'Count expression matches in the submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: submissionUploadParameters,
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: { expression: featureSearchExpressionTreeSchema }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Upload search result.',
      content: {
        'application/json': {
          schema: featureSearchCountResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Handle upload-scoped expression counts.
 * @returns {RequestHandler} Transactional HTTP handler.
 */
export function countSubmissionUploadFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const expression = validateSearchExpressionTree(req.body.expression) ?? null;
      const searchFeatureService = new SearchFeatureService(connection);
      const total = await searchFeatureService.countSubmissionUploadFeatures(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        { expression }
      );
      await connection.commit();
      return res.status(200).json({ total });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

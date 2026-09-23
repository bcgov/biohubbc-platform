import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../../../openapi/schemas/http-responses';
import { paginationRequestBodySchema } from '../../../../../../../../../../openapi/schemas/pagination';
import { featureSearchExpressionTreeSchema } from '../../../../../../../../../../openapi/schemas/search/search-feature';
import {
  submissionFeatureSecuritySelectedRulesResponseSchema,
  submissionUploadReviewSecurityParameters
} from '../../../../../../../../../../openapi/schemas/submission-feature-security';
import { authorizeRequestHandler } from '../../../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewSecurityService } from '../../../../../../../../../../services/upload/submission-upload-review-security-service';
import { makePaginationOptionsFromBody } from '../../../../../../../../../../utils/pagination';
import { validateSearchExpressionTree } from '../../../../../../../../../../utils/search-feature-validation';

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadReviewSecurityAssignments()
];

POST.apiDoc = {
  description: 'List direct rule states for the selected upload features.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: submissionUploadReviewSecurityParameters,
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            submissionFeatureIds: { type: 'array', items: { type: 'integer', minimum: 1 } },
            expression: featureSearchExpressionTreeSchema,
            search: { type: 'string' },
            pagination: paginationRequestBodySchema
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Security review results.',
      content: { 'application/json': { schema: submissionFeatureSecuritySelectedRulesResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Handle POST for the review security resource.
 * The review orchestrator resolves selection, expression, or whole-upload scope.
 * @returns {RequestHandler} Transactional HTTP handler.
 */
export function getSubmissionUploadReviewSecurityAssignments(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const submissionUploadReviewSecurityService = new SubmissionUploadReviewSecurityService(connection);
      const result = await submissionUploadReviewSecurityService.getSubmissionUploadReviewSecurityAssignments(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        req.params.submissionUploadReviewId,
        {
          keyword: req.body.search,
          submissionFeatureIds: req.body.submissionFeatureIds,
          expression: validateSearchExpressionTree(req.body.expression)
        },
        makePaginationOptionsFromBody(req)
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

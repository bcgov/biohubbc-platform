import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../../../../openapi/schemas/http-responses';
import { featureSearchExpressionTreeSchema } from '../../../../../../../../../../../openapi/schemas/search/search-feature';
import { submissionUploadReviewSecurityParameters } from '../../../../../../../../../../../openapi/schemas/submission-feature-security';
import { authorizeRequestHandler } from '../../../../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewSecurityService } from '../../../../../../../../../../../services/upload/submission-upload-review-security-service';
import { validateSearchExpressionTree } from '../../../../../../../../../../../utils/search-feature-validation';

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteSubmissionUploadReviewSecurityAssignments()
];

POST.apiDoc = {
  description:
    'Reset direct security for selected upload features; without explicit IDs, reset expression matches or the whole upload when no expression is supplied.',
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
            expression: featureSearchExpressionTreeSchema
          }
        }
      }
    }
  },
  responses: { 204: { description: 'Security assignments updated.' }, ...defaultErrorResponses }
};

/**
 * Handle POST for the review security resource.
 * @returns {RequestHandler} Transactional HTTP handler.
 */
export function deleteSubmissionUploadReviewSecurityAssignments(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const submissionUploadReviewSecurityService = new SubmissionUploadReviewSecurityService(connection);
      await submissionUploadReviewSecurityService.deleteSubmissionUploadReviewSecurityAssignments(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        req.params.submissionUploadReviewId,
        req.body.submissionFeatureIds ?? [],
        validateSearchExpressionTree(req.body.expression)
      );
      await connection.commit();
      return res.status(204).send();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

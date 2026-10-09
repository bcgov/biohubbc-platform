import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../../../../../openapi/schemas/http-responses';
import { featureSearchExpressionTreeSchema } from '../../../../../../../../../../../../openapi/schemas/search/search-feature';
import { submissionUploadReviewSecurityParameters } from '../../../../../../../../../../../../openapi/schemas/submission-feature-security';
import { authorizeRequestHandler } from '../../../../../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewSecurityService } from '../../../../../../../../../../../../services/upload/submission-upload-review-security-service';
import { validateSearchExpressionTree } from '../../../../../../../../../../../../utils/search-feature-validation';

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  insertSubmissionUploadReviewSecurityRuleAssignments()
];

PUT.apiDoc = {
  description:
    'Ensure direct assignments exist for a rule within the reviewed upload. Without explicit IDs, the expression selects matches; omitting both selects the whole upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...submissionUploadReviewSecurityParameters,
    { in: 'path', name: 'securityRuleId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
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
  responses: { 204: { description: 'Assignment state established.' }, ...defaultErrorResponses }
};

/**
 * Handle PUT for one rule's direct assignments; request scope is constrained to the reviewed upload.
 * @returns {RequestHandler} Transactional HTTP handler.
 */
export function insertSubmissionUploadReviewSecurityRuleAssignments(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SubmissionUploadReviewSecurityService(connection);
      await service.insertSubmissionUploadReviewSecurityRuleAssignments(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        req.params.submissionUploadReviewId,
        Number(req.params.securityRuleId),
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

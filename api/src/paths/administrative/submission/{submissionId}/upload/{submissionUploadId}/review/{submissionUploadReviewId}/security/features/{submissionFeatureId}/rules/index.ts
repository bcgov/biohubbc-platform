import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../../../../../../../../openapi/schemas/pagination';
import {
  submissionFeatureSecurityRulesResponseSchema,
  submissionUploadReviewSecurityParameters
} from '../../../../../../../../../../../../openapi/schemas/submission-feature-security';
import { authorizeRequestHandler } from '../../../../../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewSecurityService } from '../../../../../../../../../../../../services/upload/submission-upload-review-security-service';
import { makePaginationOptionsFromRequest } from '../../../../../../../../../../../../utils/pagination';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadReviewFeatureSecurityRules()
];

GET.apiDoc = {
  description: 'List direct and inherited rules affecting one reviewed feature.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...submissionUploadReviewSecurityParameters,
    ...paginationRequestQueryParamSchema,
    { in: 'path', name: 'submissionFeatureId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
  responses: {
    200: {
      description: 'Security review results.',
      content: { 'application/json': { schema: submissionFeatureSecurityRulesResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Handle GET for the review security resource.
 * @returns {RequestHandler} Transactional HTTP handler.
 */
export function getSubmissionUploadReviewFeatureSecurityRules(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const submissionUploadReviewSecurityService = new SubmissionUploadReviewSecurityService(connection);
      const result = await submissionUploadReviewSecurityService.getSubmissionUploadReviewFeatureSecurityRules(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        req.params.submissionUploadReviewId,
        Number(req.params.submissionFeatureId),
        makePaginationOptionsFromRequest(req)
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

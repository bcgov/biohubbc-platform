import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { cursorPaginationRequestBodySchema } from '../../../../../../../openapi/schemas/pagination';
import {
  featureSearchExpressionTreeSchema,
  submissionUploadFeatureSearchResponseSchema
} from '../../../../../../../openapi/schemas/search/search-feature';
import { submissionUploadParameters } from '../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../services/search-feature-service';
import { makeCursorPaginationOptionsFromBody } from '../../../../../../../utils/pagination';
import { registerRequestCancellation } from '../../../../../../../utils/request-cancellation';
import { validateSearchExpressionTree } from '../../../../../../../utils/search-feature-validation';

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  searchSubmissionUploadFeatures()
];

POST.apiDoc = {
  description: 'Search all features in the submission upload.',
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
          properties: { expression: featureSearchExpressionTreeSchema, pagination: cursorPaginationRequestBodySchema }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Upload search result.',
      content: { 'application/json': { schema: submissionUploadFeatureSearchResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Handle upload-scoped expression search.
 * @returns {RequestHandler} Transactional HTTP handler.
 */
export function searchSubmissionUploadFeatures(): RequestHandler {
  return async (req, res) => {
    const cancellation = registerRequestCancellation(res);
    const connection = getDBConnection(req.keycloak_token, { signal: cancellation.signal });
    try {
      await connection.open();
      const expression = validateSearchExpressionTree(req.body.expression) ?? null;
      const searchFeatureService = new SearchFeatureService(connection);
      const result = await searchFeatureService.searchSubmissionUploadFeatures(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        { expression },
        makeCursorPaginationOptionsFromBody(req)
      );
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      cancellation.unregister();
      await connection.rollback();
      throw error;
    } finally {
      cancellation.unregister();
      await connection.release();
    }
  };
}

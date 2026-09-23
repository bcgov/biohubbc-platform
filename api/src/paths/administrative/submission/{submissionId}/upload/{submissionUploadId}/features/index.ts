import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import {
  cursorPaginationRequestBodySchema,
  paginationRequestQueryParamSchema,
  paginationResponseSchema
} from '../../../../../../../openapi/schemas/pagination';
import {
  featureSearchExpressionTreeSchema,
  submissionUploadFeatureSearchResponseSchema
} from '../../../../../../../openapi/schemas/search/search-feature';
import { submissionUploadParameters } from '../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../services/search-feature-service';
import { SubmissionService } from '../../../../../../../services/submission-service';
import { getLogger } from '../../../../../../../utils/logger';
import {
  makeCursorPaginationOptionsFromBody,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../../../../utils/pagination';
import { validateSearchExpressionTree } from '../../../../../../../utils/search-feature-validation';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/features');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadFeatures()
];

GET.apiDoc = {
  description: 'Get paginated features belonging to a submission upload.',
  tags: ['admin'],
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
      description: 'Submission Upload ID',
      in: 'path',
      name: 'submissionUploadId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated submission upload features.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['features', 'pagination'],
            additionalProperties: false,
            properties: {
              features: {
                type: 'array',
                items: {
                  type: 'object',
                  required: [
                    'submission_id',
                    'submission_feature_id',
                    'feature_type_name',
                    'feature_type_id',
                    'secured'
                  ],
                  additionalProperties: false,
                  properties: {
                    submission_id: { type: 'integer', minimum: 1 },
                    submission_feature_id: { type: 'integer', minimum: 1 },
                    feature_type_name: { type: 'string' },
                    feature_type_id: { type: 'integer', minimum: 1 },
                    secured: { type: 'boolean' }
                  }
                }
              },
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get paginated features belonging to a submission upload.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function getSubmissionUploadFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();
      const service = new SubmissionService(connection);
      const [features, count] = await Promise.all([
        service.getSubmissionUploadFeatures(req.params.submissionUploadId, pagination),
        service.getSubmissionUploadFeaturesCount(req.params.submissionUploadId)
      ]);
      await connection.commit();
      return res.status(200).json({ features, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionUploadFeatures', message: 'error getting upload features', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

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
    const connection = getDBConnection(req.keycloak_token);
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
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

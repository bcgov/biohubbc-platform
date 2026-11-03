import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { SUBMISSION_FEATURE_ERROR_SORT_COLUMNS } from '../../../../../../../models/submission-feature-error';
import { SubmissionUploadScope } from '../../../../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import {
  paginationRequestQueryParamSchema,
  paginationResponseSchema
} from '../../../../../../../openapi/schemas/pagination';
import { submissionUploadParameters } from '../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionFeatureErrorService } from '../../../../../../../services/submission-feature-error-service';
import { getLogger } from '../../../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/error');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        discriminator: 'SystemRole',
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]
      }
    ]
  })),
  listSubmissionFeatureErrors()
];

GET.apiDoc = {
  description: 'List the aggregated ingestion errors of a submission upload, most frequent first by default.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...submissionUploadParameters,
    ...paginationRequestQueryParamSchema.filter((parameter) => parameter.name !== 'sort'),
    {
      in: 'query',
      name: 'sort',
      schema: { type: 'string', enum: SUBMISSION_FEATURE_ERROR_SORT_COLUMNS, default: 'count' }
    }
  ],
  responses: {
    200: {
      description: 'A page of submission feature errors.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['errors', 'pagination'],
            additionalProperties: false,
            properties: {
              errors: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'submission_feature_error_id',
                    'error_code',
                    'error_message',
                    'feature_type_name',
                    'property_name',
                    'count'
                  ],
                  properties: {
                    submission_feature_error_id: { type: 'integer', minimum: 1 },
                    error_code: { type: 'string' },
                    error_message: { type: 'string' },
                    feature_type_name: { type: 'string', nullable: true },
                    property_name: { type: 'string', nullable: true },
                    count: { type: 'integer', minimum: 0 }
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
 * List a submission upload's ingestion errors for system and data administrators.
 *
 * @returns {RequestHandler} Handler with the standard transaction and connection lifecycle.
 */
export function listSubmissionFeatureErrors(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const scope: SubmissionUploadScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId
      };
      const pagination = makePaginationOptionsFromRequest(req);
      const service = new SubmissionFeatureErrorService(connection);
      const result = await service.listSubmissionFeatureErrors(scope, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'listSubmissionFeatureErrors', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

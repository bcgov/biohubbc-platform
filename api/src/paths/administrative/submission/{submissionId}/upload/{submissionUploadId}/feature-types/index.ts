import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { ReconciliationType } from '../../../../../../../models/reconciliation';
import {
  SUBMISSION_UPLOAD_FEATURE_TYPE_SORT_COLUMNS,
  SubmissionUploadFeatureTypeFilters,
  SubmissionUploadScope
} from '../../../../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import {
  paginationRequestQueryParamSchema,
  paginationResponseSchema
} from '../../../../../../../openapi/schemas/pagination';
import { submissionUploadParameters } from '../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SearchFeatureService } from '../../../../../../../services/search-feature-service';
import { getLogger } from '../../../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../../../utils/pagination';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/feature-types'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        discriminator: 'SystemRole',
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]
      }
    ]
  })),
  listSubmissionUploadFeatureTypes()
];

GET.apiDoc = {
  description:
    'List the feature types stored in a submission upload with the number of features of each, optionally limited to one reconciliation outcome.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...submissionUploadParameters,
    {
      description: 'Count only features with this stored reconciliation outcome.',
      in: 'query',
      name: 'reconciliation',
      required: false,
      schema: { type: 'string', enum: ReconciliationType.options }
    },
    ...paginationRequestQueryParamSchema.filter((parameter) => parameter.name !== 'sort'),
    {
      in: 'query',
      name: 'sort',
      schema: { type: 'string', enum: SUBMISSION_UPLOAD_FEATURE_TYPE_SORT_COLUMNS, default: 'feature_type_name' }
    }
  ],
  responses: {
    200: {
      description: 'A page of submission upload feature types.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['feature_types', 'pagination'],
            additionalProperties: false,
            properties: {
              feature_types: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['feature_type_name', 'count'],
                  properties: {
                    feature_type_name: { type: 'string' },
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
 * List a submission upload's feature types for system and data administrators.
 *
 * @returns {RequestHandler} Handler with the standard transaction and connection lifecycle.
 */
export function listSubmissionUploadFeatureTypes(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const scope: SubmissionUploadScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId
      };
      const filters: SubmissionUploadFeatureTypeFilters = {
        reconciliation: (req.query.reconciliation as ReconciliationType | undefined) ?? null
      };
      const pagination = makePaginationOptionsFromRequest(req);
      const service = new SearchFeatureService(connection);
      const result = await service.listSubmissionUploadFeatureTypes(scope, filters, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'listSubmissionUploadFeatureTypes', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

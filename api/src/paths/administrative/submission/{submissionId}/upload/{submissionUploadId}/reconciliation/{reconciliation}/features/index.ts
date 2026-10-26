import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../database/db';
import {
  RECONCILIATION_FEATURE_DATA_SORT_COLUMNS,
  ReconciliationFeatureScope,
  ReconciliationType
} from '../../../../../../../../../models/reconciliation';
import { defaultErrorResponses } from '../../../../../../../../../openapi/schemas/http-responses';
import {
  paginationRequestQueryParamSchema,
  paginationResponseSchema
} from '../../../../../../../../../openapi/schemas/pagination';
import { reconciliationFeatureParameters } from '../../../../../../../../../openapi/schemas/reconciliation';
import { authorizeRequestHandler } from '../../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReconciliationService } from '../../../../../../../../../services/reconciliation/submission-upload-reconciliation-service';
import { getLogger } from '../../../../../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../../../../../utils/pagination';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/reconciliation/{reconciliation}/features'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getReconciliationFeatureData()
];

GET.apiDoc = {
  description:
    'List the raw submitted jsonb data of the features with one stored reconciliation outcome in a submission upload, across the complete upload lifecycle.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...reconciliationFeatureParameters,
    ...paginationRequestQueryParamSchema.filter((parameter) => parameter.name !== 'sort'),
    {
      in: 'query',
      name: 'sort',
      schema: { type: 'string', enum: RECONCILIATION_FEATURE_DATA_SORT_COLUMNS, default: 'submission_feature_id' }
    }
  ],
  responses: {
    200: {
      description: 'A page of raw reconciliation feature data.',
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
                  additionalProperties: false,
                  required: ['submission_feature_id', 'data'],
                  properties: {
                    submission_feature_id: { type: 'integer', minimum: 1 },
                    data: { type: 'object', description: 'Raw submitted feature jsonb.' }
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
 * List raw reconciliation feature data for system administrators.
 *
 * @returns {RequestHandler} Handler with the standard transaction and connection lifecycle.
 */
export function getReconciliationFeatureData(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const scope: ReconciliationFeatureScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId,
        reconciliation: req.params.reconciliation as ReconciliationType
      };
      const pagination = makePaginationOptionsFromRequest(req);
      const service = new SubmissionUploadReconciliationService(connection);
      const result = await service.getReconciliationFeatureData(scope, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getReconciliationFeatureData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

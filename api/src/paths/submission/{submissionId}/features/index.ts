import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';
import {
  ensureCompletePaginationOptions,
  makePaginationOptionsFromRequest,
  makePaginationResponse
} from '../../../../utils/pagination';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getSubmissionFeatures()
];

GET.apiDoc = {
  description: 'Retrieves a submission record from the submission table',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'A paginated list of submission features with type and security info.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['features', 'pagination'],
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
                  properties: {
                    submission_id: {
                      type: 'integer',
                      minimum: 1
                    },
                    submission_feature_id: {
                      type: 'integer',
                      minimum: 1
                    },
                    feature_type_name: {
                      type: 'string'
                    },
                    feature_type_id: {
                      type: 'integer',
                      minimum: 1
                    },
                    secured: {
                      type: 'boolean'
                    }
                  },
                  additionalProperties: false
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
 * Retrieves paginated child submission feature records.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    const submissionId = Number(req.params.submissionId);
    const paginationOptions = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      // Service method must support pagination options
      const [features, count] = await Promise.all([
        submissionService.getSubmissionFeatures(submissionId, ensureCompletePaginationOptions(paginationOptions)),
        submissionService.getSubmissionFeaturesCount(submissionId)
      ]);

      await connection.commit();

      res.status(200).json({
        features,
        pagination: makePaginationResponse(count, paginationOptions)
      });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

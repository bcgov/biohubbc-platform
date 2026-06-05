import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { SubmissionFeatureFilters } from '../../../../models/submission-feature';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [getSubmissionFeatures()];

GET.apiDoc = {
  description: 'Retrieves submission features. Supports both authenticated and anonymous users.',
  tags: ['submission'],
  security: [
    {
      OptionalBearer: []
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
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: {
        type: 'string'
      },
      description: 'Optional case-insensitive search across feature type name.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'A paginated list of submission features with security info.',
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
 * Retrieves paginated submission feature records. Uses the request token when present, otherwise the API user connection for anonymous requests.
 *
 * Returns all features (secured and unsecured).
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    const submissionId = Number(req.params.submissionId);
    const paginationOptions = makePaginationOptionsFromRequest(req);
    const filters = { search: req.query.search } as SubmissionFeatureFilters;

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const [features, count] = await Promise.all([
        submissionService.getSubmissionFeatures(submissionId, paginationOptions, filters),
        submissionService.getSubmissionFeaturesCount(submissionId, filters)
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

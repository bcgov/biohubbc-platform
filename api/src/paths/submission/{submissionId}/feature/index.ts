import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { SubmissionFeatureLifecycle } from '../../../../models/submission';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/submission/{submissionId}/feature');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionId: Number(req.params.submissionId)
      }
    ]
  })),
  getSubmissionFeatures()
];

GET.apiDoc = {
  description:
    "Retrieves one page of the submission's published (approved) features that the caller's team policy grants reach. Unreviewed features are returned by the upload's feature list instead. Available only to active members of the submission's team; every caller, including a system administrator, sees only the features their own team policy grants reach.",
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID.',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'integer', minimum: 1 },
      required: true
    },
    {
      description:
        'Lifecycle of the published features returned: current (not ended or superseded), superseded (ended or superseded), or all.',
      in: 'query',
      name: 'lifecycle',
      required: false,
      schema: { type: 'string', enum: ['current', 'superseded', 'all'], default: 'current' }
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'A paginated list of visible submission features.',
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
                  required: ['submission_id', 'submission_feature_id', 'feature_type_name', 'feature_type_id'],
                  additionalProperties: false,
                  properties: {
                    submission_id: { type: 'integer', minimum: 1 },
                    submission_feature_id: { type: 'integer', minimum: 1 },
                    feature_type_name: { type: 'string' },
                    feature_type_id: { type: 'integer', minimum: 1 }
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
 * Retrieves one page of the submission's published features in the requested lifecycle.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatures(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token!);
    const submissionId = Number(req.params.submissionId);
    const lifecycle = (req.query.lifecycle ?? 'current') as SubmissionFeatureLifecycle;
    const paginationOptions = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const submissionService = new SubmissionService(connection);
      const page = await submissionService.getSubmissionFeaturePage(
        submissionId,
        systemUserId,
        { lifecycle },
        paginationOptions
      );

      await connection.commit();

      return res.status(200).json(page);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatures', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

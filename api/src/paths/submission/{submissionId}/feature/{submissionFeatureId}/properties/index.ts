import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../../database/db';
import { SubmissionFeaturePropertyFilters } from '../../../../../../models/submission-feature';
import { SubmissionFeaturePropertiesListResponseSchema } from '../../../../../../openapi/schemas/feature-property';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyService } from '../../../../../../services/submission-feature-property-service';
import { getLogger } from '../../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../../utils/pagination';

const defaultLog = getLogger('paths/submission/{submissionId}/feature/{submissionFeatureId}/properties');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionId: Number(req.params.submissionId)
      },
      {
        discriminator: 'SubmissionFeatureGrant',
        submissionId: Number(req.params.submissionId),
        submissionFeatureId: Number(req.params.submissionFeatureId)
      }
    ]
  })),
  getSubmissionFeatureProperties()
];

GET.apiDoc = {
  description:
    "Retrieves paginated properties of one of the submission's features at any lifecycle stage. Available to active members of the submission's team whose team policy grants reach the feature, and to system administrators.",
  tags: ['submission'],
  security: [{ Bearer: [] }],
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
      description: 'Submission Feature ID.',
      in: 'path',
      name: 'submissionFeatureId',
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
      description: 'Optional case-insensitive search across property names and values.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description:
        'A paginated list of feature properties. Scalar-typed values are strings; reference-typed values are structured objects carrying a display label and stable identifiers.',
      content: {
        'application/json': {
          schema: SubmissionFeaturePropertiesListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves paginated properties of one of the submission's features, at any lifecycle stage, with server-side
 * search/sort.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatureProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token!);
    const submissionId = Number(req.params.submissionId);
    const submissionFeatureId = Number(req.params.submissionFeatureId);
    const pagination = makePaginationOptionsFromRequest(req);
    const filters = { search: req.query.search } as SubmissionFeaturePropertyFilters;

    try {
      await connection.open();

      const submissionFeaturePropertyService = new SubmissionFeaturePropertyService(connection);
      const result = await submissionFeaturePropertyService.getSubmissionFeaturePropertiesBySubmissionId(
        submissionId,
        submissionFeatureId,
        pagination,
        filters
      );

      await connection.commit();

      return res.status(200).json({
        properties: result.properties,
        pagination: makePaginationResponse(result.total, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionFeatureProperties', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../../../database/db';
import { SubmissionFeaturePropertyFilters } from '../../../../../../models/submission-feature';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import {
  paginationRequestQueryParamSchema,
  paginationResponseSchema
} from '../../../../../../openapi/schemas/pagination';
import { submissionFeaturePropertyValueSchema } from '../../../../../../openapi/schemas/submission-feature-property-value';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyService } from '../../../../../../services/submission-feature-property-service';
import { getLogger } from '../../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../../utils/pagination';

const defaultLog = getLogger('paths/submission/{submissionId}/features/{submissionFeatureId}/properties');

export const GET: Operation = [
  authorizeRequestHandler((req) => {
    return {
      and: [
        {
          discriminator: 'Policy',
          submissionFeatureId: Number(req.params.submissionFeatureId),
          submissionId: Number(req.params.submissionId)
        }
      ]
    };
  }),
  getSubmissionFeatureProperties()
];

GET.apiDoc = {
  description: 'Retrieves paginated properties for a specific submission feature.',
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
          schema: {
            type: 'object',
            required: ['properties', 'pagination'],
            additionalProperties: false,
            properties: {
              properties: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'property', 'value'],
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    property: { type: 'string' },
                    value: submissionFeaturePropertyValueSchema
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
 * Retrieves paginated submission feature properties with server-side search/sort.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionFeatureProperties(): RequestHandler {
  return async (req, res) => {
    // Unsecured features are readable anonymously (see the closure-based authorization rule on this
    // route); fall back to the API user connection when there is no keycloak token, mirroring the
    // feature list endpoint.
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();
    const submissionFeatureId = Number(req.params.submissionFeatureId);
    const pagination = makePaginationOptionsFromRequest(req);
    const filters = { search: req.query.search } as SubmissionFeaturePropertyFilters;

    try {
      await connection.open();

      const submissionFeaturePropertyService = new SubmissionFeaturePropertyService(connection);
      const result = await submissionFeaturePropertyService.getSubmissionFeatureProperties(
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

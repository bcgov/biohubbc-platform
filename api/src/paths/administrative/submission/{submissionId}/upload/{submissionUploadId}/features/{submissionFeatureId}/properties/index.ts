import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../database/db';
import { SubmissionFeaturePropertyFilters } from '../../../../../../../../../models/submission-feature';
import { SubmissionFeaturePropertiesListResponseSchema } from '../../../../../../../../../openapi/schemas/feature-property';
import { defaultErrorResponses } from '../../../../../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyService } from '../../../../../../../../../services/submission-feature-property-service';
import { SubmissionFeatureService } from '../../../../../../../../../services/submission-feature-service';
import { getLogger } from '../../../../../../../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../../../../../../../utils/pagination';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/features/{submissionFeatureId}/properties'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadFeatureProperties()
];

GET.apiDoc = {
  description: 'Get properties for a feature belonging to a submission upload under review.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    { in: 'path', name: 'submissionId', schema: { type: 'integer', minimum: 1 }, required: true },
    { in: 'path', name: 'submissionUploadId', schema: { type: 'string', format: 'uuid' }, required: true },
    { in: 'path', name: 'submissionFeatureId', schema: { type: 'integer', minimum: 1 }, required: true },
    { in: 'query', name: 'search', required: false, schema: { type: 'string' } },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Paginated feature properties.',
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
 * Get paginated properties for a feature belonging to a submission upload.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function getSubmissionUploadFeatureProperties(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const submissionId = Number(req.params.submissionId);
    const submissionFeatureId = Number(req.params.submissionFeatureId);
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();
      const submissionFeatureService = new SubmissionFeatureService(connection);
      await submissionFeatureService.getSubmissionUploadFeature(
        submissionId,
        req.params.submissionUploadId,
        submissionFeatureId
      );

      const submissionFeaturePropertyService = new SubmissionFeaturePropertyService(connection);
      const result = await submissionFeaturePropertyService.getSubmissionFeaturePropertiesBySubmissionUploadId(
        req.params.submissionUploadId,
        submissionFeatureId,
        pagination,
        { search: req.query.search } as SubmissionFeaturePropertyFilters
      );

      await connection.commit();
      return res.status(200).json({
        properties: result.properties,
        pagination: makePaginationResponse(result.total, pagination)
      });
    } catch (error) {
      defaultLog.error({
        label: 'getSubmissionUploadFeatureProperties',
        message: 'error getting upload feature properties',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

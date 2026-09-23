import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../../openapi/schemas/http-responses';
import { submissionUploadParameters } from '../../../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyGeometryService } from '../../../../../../../../../services/submission-feature-property-geometry-service';
import { getLogger } from '../../../../../../../../../utils/logger';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/features/{submissionFeatureId}/extent'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadFeatureGeometryExtent()
];

GET.apiDoc = {
  description: 'Get the spatial extent of one current upload feature, including unpublished features.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...submissionUploadParameters,
    { in: 'path', name: 'submissionFeatureId', required: true, schema: { type: 'integer', minimum: 1 } }
  ],
  responses: {
    200: {
      description: 'The feature extent, or null when there is no current spatial data in this upload.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['bbox', 'geometry_count'],
            additionalProperties: false,
            properties: {
              bbox: { type: 'array', nullable: true, minItems: 4, maxItems: 4, items: { type: 'number' } },
              geometry_count: { type: 'integer', minimum: 0 }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get the extent of a current upload feature without issuing a tile token.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function getSubmissionUploadFeatureGeometryExtent(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const service = new SubmissionFeaturePropertyGeometryService(connection);
      const extent = await service.getSubmissionUploadFeatureGeometryExtent(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        Number(req.params.submissionFeatureId)
      );
      await connection.commit();
      return res.status(200).json(extent);
    } catch (error) {
      defaultLog.error({
        label: 'getSubmissionUploadFeatureGeometryExtent',
        message: 'error getting upload feature extent',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

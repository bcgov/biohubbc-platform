import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../../database/db';
import { FeaturePropertySchema } from '../../../../../../../../../openapi/schemas/feature-property';
import { defaultErrorResponses } from '../../../../../../../../../openapi/schemas/http-responses';
import { submissionUploadParameters } from '../../../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../../../request-handlers/security/authorization';
import { SubmissionFeaturePropertyService } from '../../../../../../../../../services/submission-feature-property-service';
import { registerRequestCancellation } from '../../../../../../../../../utils/request-cancellation';
import { validateSearchFeatureType } from '../../../../../../../../../utils/search-feature-validation';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadFeatureTypeProperties()
];

GET.apiDoc = {
  description: 'Get unique property definitions used by a feature type across the submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...submissionUploadParameters,
    { in: 'path', name: 'featureType', required: true, schema: { type: 'string', minLength: 1 } }
  ],
  responses: {
    200: {
      description: 'Unique property definitions, including properties on historical upload features.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['properties'],
            additionalProperties: false,
            properties: { properties: { type: 'array', items: FeaturePropertySchema } }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Return upload-scoped property definitions with cancellation and transaction cleanup.
 * @returns {RequestHandler} Administrator feature-type properties handler.
 */
export function getSubmissionUploadFeatureTypeProperties(): RequestHandler {
  return async (req, res) => {
    const cancellation = registerRequestCancellation(res);
    const connection = getDBConnection(req.keycloak_token, { signal: cancellation.signal });
    try {
      await connection.open();
      const featureType = validateSearchFeatureType(req.params.featureType);
      const service = new SubmissionFeaturePropertyService(connection);
      const properties = await service.getSubmissionUploadFeatureTypeProperties(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        featureType
      );
      await connection.commit();
      return res.status(200).json({ properties });
    } catch (error) {
      cancellation.unregister();
      await connection.rollback();
      throw error;
    } finally {
      cancellation.unregister();
      await connection.release();
    }
  };
}

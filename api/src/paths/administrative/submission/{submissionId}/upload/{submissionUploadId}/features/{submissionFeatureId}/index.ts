import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { GetSubmissionFeatureSchema } from '../../../../../../../../schemas/submission-feature';
import { SubmissionFeatureService } from '../../../../../../../../services/submission-feature-service';
import { getLogger } from '../../../../../../../../utils/logger';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/features/{submissionFeatureId}'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadFeature()
];

GET.apiDoc = {
  description: 'Get any feature row belonging to a submission upload for administrative review.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'integer', minimum: 1 },
      required: true
    },
    {
      description: 'Submission Upload ID',
      in: 'path',
      name: 'submissionUploadId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
    {
      description: 'Submission Feature ID',
      in: 'path',
      name: 'submissionFeatureId',
      schema: { type: 'integer', minimum: 1 },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'The requested submission upload feature.',
      content: { 'application/json': { schema: GetSubmissionFeatureSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a feature belonging to a submission upload for administrative review.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function getSubmissionUploadFeature(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const service = new SubmissionFeatureService(connection);
      const feature = await service.getSubmissionUploadFeature(
        Number(req.params.submissionId),
        req.params.submissionUploadId,
        Number(req.params.submissionFeatureId)
      );
      await connection.commit();
      return res.status(200).json({ feature });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionUploadFeature', message: 'error getting upload feature', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

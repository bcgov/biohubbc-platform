import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReconciliationService } from '../../../../../../../services/reconciliation/submission-upload-reconciliation-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/reconciliation'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadReconciliationCounts()
];

GET.apiDoc = {
  description: 'Get the stored feature reconciliation outcome counts for a submission upload.',
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
    }
  ],
  responses: {
    200: {
      description: 'Submission upload reconciliation outcome counts.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['new', 'modified', 'unmodified'],
            properties: {
              new: { type: 'integer', minimum: 0 },
              modified: { type: 'integer', minimum: 0 },
              unmodified: { type: 'integer', minimum: 0 }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get immutable reconciliation outcome counts for a submission upload.
 *
 * @returns {RequestHandler} Express request handler.
 */
export function getSubmissionUploadReconciliationCounts(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const service = new SubmissionUploadReconciliationService(connection);
      const counts = await service.getSubmissionFeatureReconciliationCounts(
        Number(req.params.submissionId),
        req.params.submissionUploadId
      );

      await connection.commit();

      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.setHeader('Vary', 'Authorization');
      return res.status(200).json(counts);
    } catch (error) {
      defaultLog.error({
        label: 'getSubmissionUploadReconciliationCounts',
        message: 'error getting reconciliation counts',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

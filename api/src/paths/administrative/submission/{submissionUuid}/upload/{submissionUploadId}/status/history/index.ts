import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import { SubmissionUploadProcessingStatusHistoryItemSchema } from '../../../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../../../../utils/logger';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionUuid}/upload/{submissionUploadId}/status/history'
);

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadProcessingStatusHistory()
];

GET.apiDoc = {
  description:
    'Get the active processing status history of a submission upload, earliest first. Superseded statuses from earlier processing attempts are excluded.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID',
      in: 'path',
      name: 'submissionUuid',
      schema: { type: 'string', format: 'uuid' },
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
      description: 'Submission upload processing status history.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: SubmissionUploadProcessingStatusHistoryItemSchema
          }
        }
      }
    },
    ...defaultErrorResponses,
    404: {
      description: 'Submission upload not found for the given submission.'
    }
  }
};

/**
 * Return the active processing status history of a submission upload.
 *
 * The upload must belong to the submission identified in the path; otherwise the request is a 404.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionUploadProcessingStatusHistory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionUuid, submissionUploadId } = req.params;
      const submissionUploadService = new SubmissionUploadService(connection);

      const result = await submissionUploadService.findSubmissionUploadProcessingStatusHistory(
        submissionUuid,
        submissionUploadId
      );

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'getSubmissionUploadProcessingStatusHistory',
        message: 'error fetching submission upload processing status history',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { ApiExecuteSQLError } from '../../../../../errors/api-error';
import { HTTP404, HTTP409 } from '../../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewStatusService } from '../../../../../services/upload/submission-upload-review-status-service';
import { SubmissionUploadService } from '../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/upload/{submissionUploadId}');

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    or: [
      { discriminator: 'ServiceClient' },
      { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }
    ]
  })),
  deleteSubmissionUpload()
];

DELETE.apiDoc = {
  description:
    'Soft-delete a submission upload. Only allowed when the upload has a status of "submitted" (unreviewed). Deletion is blocked if the upload has already been approved or denied.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID (UUID).',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    },
    {
      description: 'Submission Upload ID (UUID).',
      in: 'path',
      name: 'submissionUploadId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  responses: {
    204: {
      description: 'Submission upload successfully soft-deleted.'
    },
    ...defaultErrorResponses,
    404: {
      description:
        'Submission not found (invalid submissionId) or submission upload not found (invalid submissionUploadId, no status record, or upload does not belong to this submission).'
    },
    409: {
      description: 'Cannot delete a submission upload that has already been reviewed (approved or denied).'
    }
  }
};

/**
 * Soft-deletes a submission upload, provided it has not yet been reviewed.
 *
 * @returns {RequestHandler}
 */
export function deleteSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionId: submissionIdParam, submissionUploadId } = req.params;

      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.getSubmissionUploadForSubmissionOrThrow(submissionIdParam, submissionUploadId);

      const reviewStatusService = new SubmissionUploadReviewStatusService(connection);
      let reviewStatus;
      try {
        reviewStatus = await reviewStatusService.getSubmissionUploadReviewStatus(submissionUploadId);
      } catch (err) {
        if (err instanceof ApiExecuteSQLError && err.message === 'Failed to get submission_upload_status record') {
          throw new HTTP404('Submission upload not found');
        }
        throw err;
      }

      if (reviewStatus.status !== 'submitted') {
        throw new HTTP409(
          `Cannot delete a submission upload with status "${reviewStatus.status}". Only uploads with status "submitted" may be deleted.`
        );
      }

      await submissionUploadService.softDeleteSubmissionUpload(submissionUploadId);

      await reviewStatusService.updateSubmissionUploadReviewStatus(submissionUploadId, { status: 'deleted' });

      await connection.commit();

      res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteSubmissionUpload', message: 'error deleting submission upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

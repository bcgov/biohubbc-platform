import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionUuid}/upload/{submissionUploadId}');

export const DELETE: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        discriminator: 'Team',
        entity: 'submission_upload',
        submissionUploadId: req.params.submissionUploadId
      },
      { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }
    ]
  })),
  deleteSubmissionUpload()
];

DELETE.apiDoc = {
  description:
    'Soft-delete a submission upload. The bearer token must identify a member of the upload team, or a system administrator. Deletion is only allowed when the upload has a status of "submitted" (unreviewed).',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID.',
      in: 'path',
      name: 'submissionUuid',
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
        'Submission not found (invalid submissionUuid) or submission upload not found (invalid submissionUploadId, no status record, or upload does not belong to this submission).'
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

      const { submissionUuid, submissionUploadId } = req.params;

      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.deleteSubmissionUpload(submissionUuid, submissionUploadId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteSubmissionUpload', message: 'error deleting submission upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../../database/db';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from '../../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionUuid}/upload/{submissionUploadId}');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionUuid: req.params.submissionUuid
      }
    ]
  })),
  getSubmissionUpload()
];

GET.apiDoc = {
  description:
    "Get one of a submission's active uploads: its identifier, processing status, review decision and creation date. Available to active members of the submission's team and to system administrators.",
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID.',
      in: 'path',
      name: 'submissionUuid',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
    {
      description: 'Submission Upload ID (UUID).',
      in: 'path',
      name: 'submissionUploadId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'The submission upload.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['submission_upload_id', 'status', 'decision', 'create_date'],
            additionalProperties: false,
            properties: {
              submission_upload_id: { type: 'string', format: 'uuid' },
              status: { type: 'string', enum: SubmissionUploadJobStatus.options },
              decision: { type: 'string', enum: SubmissionUploadDecision.options },
              create_date: { type: 'string' }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Gets one of a submission's active uploads for members of the submission's team.
 *
 * Only the upload's identifier, status, decision and creation date are returned.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token!);

    try {
      await connection.open();

      const submissionUploadService = new SubmissionUploadService(connection);
      const upload = await submissionUploadService.getSubmissionUploadBySubmissionUuid(
        req.params.submissionUuid,
        req.params.submissionUploadId
      );

      await connection.commit();

      return res.status(200).json({
        submission_upload_id: upload.submission_upload_id,
        status: upload.status,
        decision: upload.decision,
        create_date: upload.create_date
      });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionUpload', message: 'error getting submission upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const DELETE: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission_upload',
        submissionUploadId: req.params.submissionUploadId
      }
    ]
  })),
  deleteSubmissionUpload()
];

DELETE.apiDoc = {
  description:
    'Soft-delete a submission upload. The bearer token must identify an active member of the submission contributor and the upload team, or a system administrator. Deletion is only allowed while the upload decision is still pending (unreviewed).',
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
        'Submission not found (invalid submissionUuid) or submission upload not found (invalid submissionUploadId, or upload does not belong to this submission).'
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmissionUploadStatusHistoryResponseSchema } from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { SubmissionUploadReviewStatusService } from '../../../../services/upload/submission-upload-review-status-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/history');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'ServiceClient' }]
  })),
  getSubmissionHistory()
];

GET.apiDoc = {
  description:
    'Return publish history for the submission from submission_upload_status (all status records, newest first).',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Publish history for the submission.',
      content: {
        'application/json': {
          schema: SubmissionUploadStatusHistoryResponseSchema
        }
      }
    },
    ...defaultErrorResponses,
    404: {
      description: 'Submission not found (invalid submission UUID).'
    }
  }
};

/**
 * Returns publish history (submission_upload_status records) for the submission, newest first.
 *
 * @returns {RequestHandler}
 */
export function getSubmissionHistory(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const submissionUuid = req.params.submissionId as string;
      const reviewStatusService = new SubmissionUploadReviewStatusService(connection);
      const rows = await reviewStatusService.getSubmissionUploadStatusHistory(submissionUuid);

      const history = rows.map((row) => ({
        submissionUploadId: row.submission_upload_id,
        status: row.status,
        ...(row.create_date && {
          createDate: row.create_date instanceof Date ? row.create_date.toISOString() : String(row.create_date)
        })
      }));

      let submissionId: number;
      if (rows.length > 0) {
        submissionId = rows[0].submission_id;
      } else {
        const submissionService = new SubmissionService(connection);
        const byUuid = await submissionService.getSubmissionIdByUUID(submissionUuid);
        if (!byUuid) {
          await connection.rollback();
          return res.status(404).json({ message: 'Submission not found.' });
        }
        submissionId = byUuid.submission_id;
      }

      await connection.commit();

      res.status(200).json({ submissionId, history });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionHistory', message: 'error fetching submission history', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

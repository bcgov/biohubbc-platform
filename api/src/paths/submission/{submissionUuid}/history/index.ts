import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SubmissionUploadStatusHistoryResponseSchema } from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewStatusService } from '../../../../services/upload/submission-upload-review-status-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionUuid}/history');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionUuid: req.params.submissionUuid
      },
      { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }
    ]
  })),
  getSubmissionHistory()
];

GET.apiDoc = {
  description:
    'Return all upload status history for a submission. Available to submission-team members and system administrators.',
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

      const submissionUuid = req.params.submissionUuid;
      const reviewStatusService = new SubmissionUploadReviewStatusService(connection);
      const result = await reviewStatusService.getSubmissionHistoryByUuid(submissionUuid);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionHistory', message: 'error fetching submission history', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

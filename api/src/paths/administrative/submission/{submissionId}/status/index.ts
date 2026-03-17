import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { SubmissionStatusResponseSchema } from '../../../../../openapi/schemas/submission-upload-status';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadStatusService } from '../../../../../services/submission-upload-status-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getSubmissionUploadStatus()
];

GET.apiDoc = {
  description: 'Retrieves the submission upload and security status',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'Submission ID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Submission upload and security status',
      content: {
        'application/json': {
          schema: SubmissionStatusResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves a submission record with all security data
 *
 * @returns {RequestHandler}
 */
export function getSubmissionUploadStatus(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionUploadStatusService = new SubmissionUploadStatusService(connection);

      const result = await submissionUploadStatusService.getSubmissionUploadStatus(submissionId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionUploadStatus', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

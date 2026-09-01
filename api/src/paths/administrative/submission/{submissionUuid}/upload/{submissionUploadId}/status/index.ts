import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import {
  SubmissionUploadReviewStatusResponseSchema,
  UpdateSubmissionUploadReviewStatusRequestSchema
} from '../../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/{submissionUuid}/upload/{submissionUploadId}/status');

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  updateSubmissionUploadReviewStatus()
];

PATCH.apiDoc = {
  description:
    'Update the review status of a submission upload to approved or denied. Only system administrators may perform this action.',
  tags: ['admin'],
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
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateSubmissionUploadReviewStatusRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Submission upload review status updated successfully.',
      content: {
        'application/json': {
          schema: SubmissionUploadReviewStatusResponseSchema
        }
      }
    },
    ...defaultErrorResponses,
    400: {
      description:
        'Approval preconditions not met: automated validation has not completed, or indexing has not completed.'
    },
    404: {
      description:
        'Submission not found (invalid submissionUuid) or submission upload not found (submissionUploadId does not belong to this submission).'
    },
    409: {
      description: 'The review decision conflicts with the upload lifecycle or would reverse published feature state.'
    }
  }
};

/**
 * Updates the review status (approved or denied) for a submission upload.
 * Only system administrators are authorized to call this endpoint.
 *
 * @returns {RequestHandler}
 */
export function updateSubmissionUploadReviewStatus(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionUuid, submissionUploadId } = req.params;
      const { status } = req.body;

      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);

      const result = await submissionUploadService.updateSubmissionUploadReviewStatus(submissionUploadId, { status });

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'updateSubmissionUploadReviewStatus',
        message: 'error updating submission upload review status',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { SubmissionUploadReviewScope } from '../../../../../../../models/submission-upload-review';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import {
  RequestSubmissionUploadReviewRequestSchema,
  SubmissionUploadReviewResponseSchema
} from '../../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewService } from '../../../../../../../services/upload/submission-upload-review-service';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/review');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  requestSubmissionUploadReview()
];

POST.apiDoc = {
  description: 'Request a scoped human review task for a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID (UUID).',
      in: 'path',
      name: 'submissionId',
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
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: RequestSubmissionUploadReviewRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Submission upload review requested successfully.',
      content: {
        'application/json': {
          schema: SubmissionUploadReviewResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function requestSubmissionUploadReview(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionId: submissionIdParam, submissionUploadId } = req.params;
      const { scope, note, metadata } = req.body;

      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.getSubmissionUploadBySubmissionUuid(submissionIdParam, submissionUploadId);

      const reviewService = new SubmissionUploadReviewService(connection);
      const result = await reviewService.requestReview({
        submissionUploadId,
        scope: scope as SubmissionUploadReviewScope,
        requestedBy: connection.systemUserId(),
        note,
        metadata
      });

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'requestSubmissionUploadReview',
        message: 'error requesting submission upload review',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

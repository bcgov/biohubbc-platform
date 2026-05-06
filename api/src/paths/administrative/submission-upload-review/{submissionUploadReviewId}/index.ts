import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { SubmissionUploadReviewStatus } from '../../../../models/submission-upload-review';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  SubmissionUploadReviewResponseSchema,
  UpdateSubmissionUploadReviewRequestSchema
} from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewService } from '../../../../services/upload/submission-upload-review-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission-upload-review/{submissionUploadReviewId}');

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
        discriminator: 'SystemRole'
      }
    ]
  })),
  updateSubmissionUploadReview()
];

PATCH.apiDoc = {
  description: 'Update a scoped human review task for a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission upload review ID.',
      in: 'path',
      name: 'submissionUploadReviewId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: UpdateSubmissionUploadReviewRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Submission upload review updated successfully.',
      content: {
        'application/json': {
          schema: SubmissionUploadReviewResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function updateSubmissionUploadReview(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionUploadReviewId } = req.params;
      const { status } = req.body;

      const reviewService = new SubmissionUploadReviewService(connection);
      const result = await reviewService.updateReviewStatus({
        submissionUploadReviewId,
        status: status as SubmissionUploadReviewStatus
      });

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'updateSubmissionUploadReview',
        message: 'error updating submission upload review',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { SubmissionUploadReviewScope } from '../../../../../models/submission-upload-review';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import {
  RequestSubmissionUploadReviewRequestSchema,
  SubmissionUploadReviewResponseSchema
} from '../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewService } from '../../../../../services/upload/submission-upload-review-service';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission-upload/{submissionUploadId}/review');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadReviews()
];

GET.apiDoc = {
  description: 'Get active human review tasks for a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
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
      description: 'Submission upload reviews.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: SubmissionUploadReviewResponseSchema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  insertSubmissionUploadReview()
];

POST.apiDoc = {
  description: 'Create a scoped human review task for a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
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
      description: 'Submission upload review created successfully.',
      content: {
        'application/json': {
          schema: SubmissionUploadReviewResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getSubmissionUploadReviews(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionUploadId } = req.params;

      const submissionUploadReviewService = new SubmissionUploadReviewService(connection);
      const result = await submissionUploadReviewService.findReviewsBySubmissionUploadId(submissionUploadId);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'getSubmissionUploadReviews',
        message: 'error getting submission upload reviews',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export function insertSubmissionUploadReview(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionUploadId } = req.params;
      const { scope }: { scope: SubmissionUploadReviewScope } = req.body;

      const submissionUploadReviewService = new SubmissionUploadReviewService(connection);
      const result = await submissionUploadReviewService.insertSubmissionUploadReview({
        submission_upload_id: submissionUploadId,
        scope,
        requested_by: connection.systemUserId()
      });

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'insertSubmissionUploadReview',
        message: 'error inserting submission upload review',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

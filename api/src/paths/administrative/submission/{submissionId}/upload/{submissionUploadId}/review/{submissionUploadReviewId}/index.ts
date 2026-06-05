import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../../database/db';
import { SubmissionUploadReviewStatus } from '../../../../../../../../models/submission-upload-review';
import { defaultErrorResponses } from '../../../../../../../../openapi/schemas/http-responses';
import {
  SubmissionUploadReviewResponseSchema,
  UpdateSubmissionUploadReviewRequestSchema
} from '../../../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadReviewService } from '../../../../../../../../services/upload/submission-upload-review-service';
import { getLogger } from '../../../../../../../../utils/logger';

const defaultLog = getLogger(
  'paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/review/{submissionUploadReviewId}'
);

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateSubmissionUploadReview()
];

PATCH.apiDoc = {
  description: 'Update a scoped human review task for a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
    {
      description: 'Submission Upload ID',
      in: 'path',
      name: 'submissionUploadId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
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

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteSubmissionUploadReview()
];

DELETE.apiDoc = {
  description: 'Soft delete a scoped human review task for a submission upload.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission ID',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
    {
      description: 'Submission Upload ID',
      in: 'path',
      name: 'submissionUploadId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    },
    {
      description: 'Submission upload review ID.',
      in: 'path',
      name: 'submissionUploadReviewId',
      schema: { type: 'string', format: 'uuid' },
      required: true
    }
  ],
  responses: {
    204: {
      description: 'Submission upload review deleted successfully.'
    },
    ...defaultErrorResponses
  }
};

export function updateSubmissionUploadReview(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionId, submissionUploadId, submissionUploadReviewId } = req.params;
      const { status }: { status: SubmissionUploadReviewStatus } = req.body;

      const submissionUploadReviewService = new SubmissionUploadReviewService(connection);
      const result = await submissionUploadReviewService.updateSubmissionUploadReview(
        submissionId,
        submissionUploadId,
        submissionUploadReviewId,
        { status }
      );

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

export function deleteSubmissionUploadReview(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionId, submissionUploadId, submissionUploadReviewId } = req.params;

      const submissionUploadReviewService = new SubmissionUploadReviewService(connection);
      await submissionUploadReviewService.deleteSubmissionUploadReview(
        submissionId,
        submissionUploadId,
        submissionUploadReviewId
      );

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({
        label: 'deleteSubmissionUploadReview',
        message: 'error deleting submission upload review',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

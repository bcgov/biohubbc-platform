import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import {
  SubmissionUploadDecisionResponseSchema,
  UpdateSubmissionUploadDecisionRequestSchema
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
  updateSubmissionUploadDecision()
];

PATCH.apiDoc = {
  description:
    'Record the human review decision on a submission upload: approved, denied, or pending to clear a prior decision. Only system administrators may perform this action.',
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
        schema: UpdateSubmissionUploadDecisionRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Submission upload decision recorded successfully.',
      content: {
        'application/json': {
          schema: SubmissionUploadDecisionResponseSchema
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
      description: 'The decision would reverse published feature state.'
    }
  }
};

/**
 * Records the human review decision for a submission upload.
 * Only system administrators are authorized to call this endpoint.
 *
 * @returns {RequestHandler}
 */
export function updateSubmissionUploadDecision(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const { submissionUuid, submissionUploadId } = req.params;
      const { decision } = req.body;

      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.getSubmissionUploadBySubmissionUuid(submissionUuid, submissionUploadId);

      const result = await submissionUploadService.updateSubmissionUploadDecision(submissionUploadId, { decision });

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({
        label: 'updateSubmissionUploadDecision',
        message: 'error recording submission upload decision',
        error
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

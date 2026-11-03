import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { SubmissionUploadScope } from '../../../../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { submissionUploadParameters } from '../../../../../../../openapi/schemas/submission-upload';
import { ReindexSubmissionUploadRequestSchema } from '../../../../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}/upload/{submissionUploadId}/indexing');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  reindexSubmissionUpload()
];

POST.apiDoc = {
  description:
    'Re-index an unapproved submission upload, optionally against a different blueprint. Rebuilds the upload validation errors and property values from its reconciled features, then re-runs automatic security screening. Only system administrators may perform this action.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: submissionUploadParameters,
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: ReindexSubmissionUploadRequestSchema
      }
    }
  },
  responses: {
    202: {
      description: 'Re-indexing queued; the upload status is reconciled until the index job completes.'
    },
    ...defaultErrorResponses,
    400: {
      description: 'The requested blueprint cannot be used for the upload.'
    },
    404: {
      description: 'Submission upload not found, or it does not belong to the submission.'
    },
    409: {
      description:
        'The upload is still processing, failed before reconciliation, has a decision, has activated features, or has been superseded.'
    }
  }
};

/**
 * Queue a re-index of a submission upload within an administrator-owned transaction.
 *
 * @returns {RequestHandler} Handler that responds 202 once the re-index is queued.
 */
export function reindexSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const scope: SubmissionUploadScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId
      };
      const blueprintId: number = req.body.blueprintId;

      const submissionUploadService = new SubmissionUploadService(connection);
      await submissionUploadService.reindexSubmissionUpload(scope, blueprintId);

      await connection.commit();

      return res.status(202).send();
    } catch (error) {
      defaultLog.error({ label: 'reindexSubmissionUpload', message: 'error re-indexing submission upload', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

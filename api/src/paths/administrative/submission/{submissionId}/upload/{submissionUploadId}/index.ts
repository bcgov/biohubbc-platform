import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../database/db';
import { SubmissionUploadScope } from '../../../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../../../openapi/schemas/http-responses';
import {
  AdminSubmissionUploadSchema,
  submissionUploadParameters
} from '../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../services/upload/submission-upload-service';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }]
  })),
  getAdminSubmissionUpload()
];

GET.apiDoc = {
  description: 'Read an active submission upload, including its processing status and decision.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: submissionUploadParameters,
  responses: {
    200: {
      description: 'Submission upload.',
      content: { 'application/json': { schema: AdminSubmissionUploadSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Read an upload within an administrator-owned transaction.
 *
 * @returns {RequestHandler} Handler with transaction cleanup.
 */
export function getAdminSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const scope: SubmissionUploadScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId
      };

      const submissionUploadService = new SubmissionUploadService(connection);
      const result = await submissionUploadService.getAdminSubmissionUpload(scope);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

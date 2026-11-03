import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../../../constants/roles';
import { getDBConnection } from '../../../../../../../database/db';
import { SubmissionUploadScope } from '../../../../../../../models/submission-upload';
import { BlueprintSchema } from '../../../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../../../openapi/schemas/http-responses';
import { submissionUploadParameters } from '../../../../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../../../services/upload/submission-upload-service';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }]
  })),
  getSubmissionUploadBlueprint()
];

GET.apiDoc = {
  description: 'Read the blueprint a submission upload was created with.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: submissionUploadParameters,
  responses: {
    200: {
      description: 'Submission upload blueprint.',
      content: { 'application/json': { schema: BlueprintSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Read an upload's blueprint within an administrator-owned transaction.
 * @returns {RequestHandler} Handler with transaction cleanup.
 */
export function getSubmissionUploadBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const scope: SubmissionUploadScope = {
        submissionId: Number(req.params.submissionId),
        submissionUploadId: req.params.submissionUploadId
      };
      const service = new SubmissionUploadService(connection);
      const result = await service.getSubmissionUploadBlueprint(scope);
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

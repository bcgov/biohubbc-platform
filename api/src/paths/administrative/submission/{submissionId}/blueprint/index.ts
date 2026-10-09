import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { BlueprintSchema } from '../../../../../openapi/schemas/blueprint';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../../services/submission-service';

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR], discriminator: 'SystemRole' }]
  })),
  getSubmissionDefaultBlueprint()
];

GET.apiDoc = {
  description:
    "Read the blueprint a submission's next upload uses when the upload request does not name one: the submission's default, or the system default when the submission has none.",
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'submissionId', required: true, schema: { type: 'integer', minimum: 1 } }],
  responses: {
    200: {
      description: 'Submission default blueprint.',
      content: { 'application/json': { schema: BlueprintSchema } }
    },
    ...defaultErrorResponses
  }
};

/**
 * Read a submission's default blueprint within an administrator-owned transaction.
 * @returns {RequestHandler} Handler with transaction cleanup.
 */
export function getSubmissionDefaultBlueprint(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SubmissionService(connection);
      const result = await service.getSubmissionDefaultBlueprint(Number(req.params.submissionId));
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

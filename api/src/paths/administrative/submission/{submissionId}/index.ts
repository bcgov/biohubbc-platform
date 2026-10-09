import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { updateSubmissionRequestSchema } from '../../../../openapi/schemas/submission';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';

export const PATCH: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateSubmission()
];

PATCH.apiDoc = {
  description:
    "Update a submission's administrative settings. `default_blueprint_id` sets the blueprint its future uploads use when the upload request does not name one; existing uploads keep the blueprint they were created with.",
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [{ in: 'path', name: 'submissionId', required: true, schema: { type: 'integer', minimum: 1 } }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: updateSubmissionRequestSchema } }
  },
  responses: {
    204: { description: 'Submission updated.' },
    ...defaultErrorResponses
  }
};

/**
 * Update a submission within an administrator-owned transaction.
 * @returns {RequestHandler} Handler with transaction cleanup.
 */
export function updateSubmission(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SubmissionService(connection);
      await service.updateSubmissionDefaultBlueprint(Number(req.params.submissionId), req.body.default_blueprint_id);
      await connection.commit();
      return res.status(204).send();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

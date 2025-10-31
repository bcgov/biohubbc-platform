import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionProcessService } from '../../../../services/submission-process-service';
import { getServiceClientSystemUser } from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/validate');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    or: [
      {
        discriminator: 'SystemRole',
        validSystemRoles: [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN]
      }
    ]
  })),
  processSubmission()
];

POST.apiDoc = {
  description: 'Validate and index the features of a submission',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'The submission ID of the record to process',
      in: 'path',
      name: 'submissionId',
      schema: { type: 'string' },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Submission processed successfully'
    },
    ...defaultErrorResponses
  }
};

/**
 * NOTE: If the submission has already been processed, reprocessing will fail.
 *
 * @returns
 */
export function processSubmission(): RequestHandler {
  return async (req, res) => {
    const token = req['keycloak_token'];

    const serviceClientSystemUser = getServiceClientSystemUser(token);

    const connection = serviceClientSystemUser
      ? getServiceAccountDBConnection(serviceClientSystemUser)
      : getDBConnection(token);

    try {
      await connection.open();

      const submissionId = Number(req.params.submissionId);

      const submissionService = new SubmissionProcessService(connection);

      await submissionService.processSubmission(submissionId);

      await connection.commit();

      return res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'processSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

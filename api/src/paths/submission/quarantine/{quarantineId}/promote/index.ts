import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionProcessService } from '../../../../../services/submission-process-service';
import { getServiceClientSystemUser } from '../../../../../utils/keycloak-utils';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/quarantine/{quarantineId}/promote');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    or: [
      {
        discriminator: 'SystemRole',
        validSystemRoles: [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN]
      }
    ]
  })),
  promoteQuarantinedSubmission()
];

POST.apiDoc = {
  description:
    'Promote a quarantined submission to the main submission bucket, skipping the malware scan if incomplete.',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'The quarantine ID of the record to promote',
      in: 'path',
      name: 'quarantineId',
      schema: { type: 'string' },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Promoted successfully'
    },
    ...defaultErrorResponses
  }
};

export function promoteQuarantinedSubmission(): RequestHandler {
  return async (req, res) => {
    const token = req['keycloak_token'];

    const serviceClientSystemUser = getServiceClientSystemUser(token);

    const connection = serviceClientSystemUser
      ? getServiceAccountDBConnection(serviceClientSystemUser)
      : getDBConnection(token);

    try {
      await connection.open();

      const quarantineId = req.params.quarantineId;

      const submissionProcessService = new SubmissionProcessService(connection);

      await submissionProcessService.processQuarantinedSubmission(quarantineId);

      await connection.commit();

      return res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'promoteQuarantinedSubmission', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

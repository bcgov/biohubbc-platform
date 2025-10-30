import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../../../../database/db';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { QuarantineService } from '../../../../../services/quarantine/quarantine-service';
import { getServiceClientSystemUser } from '../../../../../utils/keycloak-utils';
import { getLogger } from '../../../../../utils/logger';

const defaultLog = getLogger('paths/submission/quarantine/{quarantineId}');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    or: [
      {
        discriminator: 'SystemRole',
        validSystemRoles: [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN]
      }
    ]
  })),
  malwareScanQuarantineRecord()
];

POST.apiDoc = {
  description: 'Trigger a malware scan for a specific quarantine record',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'The quarantine ID of the record to scan',
      in: 'path',
      name: 'quarantineId',
      schema: { type: 'string' },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Scan completed successfully'
    },
    ...defaultErrorResponses
  }
};

export function malwareScanQuarantineRecord(): RequestHandler {
  return async (req, res) => {
    const token = req['keycloak_token'];

    const serviceClientSystemUser = getServiceClientSystemUser(token);

    const connection = serviceClientSystemUser
      ? getServiceAccountDBConnection(serviceClientSystemUser)
      : getDBConnection(token);

    try {
      await connection.open();

      const quarantineId = req.params.quarantineId;

      const quarantineService = new QuarantineService(connection);

      await quarantineService.scanQuarantineRecord(quarantineId);

      await connection.commit();

      return res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'malwareScanQuarantineRecord', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

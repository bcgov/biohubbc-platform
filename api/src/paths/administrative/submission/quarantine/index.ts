import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { GetQuarantinedSubmissionsSchema } from '../../../../schemas/quarantine';
import { QuarantineService } from '../../../../services/quarantine/quarantine-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/submission/quarantine');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getQuarantinedSubmissions()
];

GET.apiDoc = {
  description: 'Get a list of submissions that are quarantined and undergoing processing.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  responses: {
    200: {
      description: 'List of quarantined submissions',
      content: {
        'application/json': {
          schema: GetQuarantinedSubmissionsSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all quarantined submissions.
 *
 * @returns {RequestHandler}
 */
export function getQuarantinedSubmissions(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const quarantineService = new QuarantineService(connection);
      const submissions = await quarantineService.getQuarantineRecordsWithScans();

      await connection.commit();

      return res.status(200).json({ submissions });
    } catch (error) {
      defaultLog.error({ label: 'getQuarantinedSubmissions', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

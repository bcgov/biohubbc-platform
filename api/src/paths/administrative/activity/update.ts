import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { AdministrativeService } from '../../../services/administrative-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/activity/update');

export const PUT: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getUpdateAdministrativeActivityHandler()
];

PUT.apiDoc = {
  description: 'Update an existing administrative activity.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Administrative activity request object.',
    content: {
      'application/json': {
        schema: {
          title: 'Administrative activity put object',
          type: 'object',
          required: ['id', 'status'],
          properties: {
            id: {
              title: 'administrative activity record ID',
              type: 'number'
            },
            status: {
              title: 'administrative activity status type code ID',
              type: 'number'
            }
          }
        }
      }
    }
  },
  responses: {
    ...defaultErrorResponses
  }
};

/**
 * Get a request handler to update an existing administrative activity.
 *
 * @returns {RequestHandler}
 */
export function getUpdateAdministrativeActivityHandler(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({
      label: 'getUpdateAdministrativeActivityHandler',
      message: 'params',
      req_body: req.body
    });

    const administrativeActivityId = Number(req.body?.id);
    const administrativeActivityStatusTypeId = Number(req.body?.status);

    const connection = getDBConnection(req['keycloak_token']);
    const administrativeService = new AdministrativeService(connection);

    try {
      await connection.open();

      await administrativeService.updateAdministrativeActivity(
        administrativeActivityId,
        administrativeActivityStatusTypeId
      );

      await connection.commit();

      return res.status(200).send();
    } catch (error) {
      defaultLog.error({ label: 'getUpdateAdministrativeActivityHandler', message: 'error', error });
      throw error;
    } finally {
      connection.release();
    }
  };
}

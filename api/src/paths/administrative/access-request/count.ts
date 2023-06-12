import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { hasPendingAdministrativeActivitiesResponseObject } from '../../../openapi/schemas/administrative-activity';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { AdministrativeService } from '../../../services/administrative-service';
import { getUserIdentifier } from '../../../utils/keycloak-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/access-request/count');

export const GET: Operation = [getPendingAccessRequestsCount()];

GET.apiDoc = {
  description: 'Has one or more pending Administrative Activities.',
  tags: ['access request'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Administrative Activity get request object.',
    content: {
      'application/json': {
        schema: {
          title: 'Administrative Activity request object',
          type: 'object',
          properties: {}
        }
      }
    }
  },
  responses: {
    200: {
      description: '`Has Pending Administrative Activities` get response object.',
      content: {
        'application/json': {
          schema: {
            ...(hasPendingAdministrativeActivitiesResponseObject as object)
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all projects.
 *
 * @returns {RequestHandler}
 */
export function getPendingAccessRequestsCount(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    const administrativeService = new AdministrativeService(connection);

    try {
      const userIdentifier = getUserIdentifier(req['keycloak_token']);

      if (!userIdentifier) {
        throw new HTTP400('Missing required userIdentifier');
      }

      await connection.open();

      const result = await administrativeService.getPendingAccessRequestCount(userIdentifier);
      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getPendingAccessRequestsCount', message: 'error', error });

      throw error;
    } finally {
      connection.release();
    }
  };
}

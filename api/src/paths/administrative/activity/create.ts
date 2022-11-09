import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { HTTP500 } from '../../../errors/http-error';
import { administrativeActivityResponseObject } from '../../../openapi/schemas/administrative-activity';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { AdministrativeService } from '../../../services/administrative-service';
import { GCNotifyService } from '../../../services/gcnotify-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/administrative/activity/list');

export const POST: Operation = [createAdministrativeActivity()];

POST.apiDoc = {
  description: 'Create a new Administrative Activity.',
  tags: ['admin'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Administrative Activity post request object.',
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
      description: 'Administrative activity post response object.',
      content: {
        'application/json': {
          schema: {
            ...(administrativeActivityResponseObject as object)
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Creates a new access request record.
 *
 * @returns {RequestHandler}
 */
export function createAdministrativeActivity(): RequestHandler {
  return async (req, res) => {
    const connection = getAPIUserDBConnection();
    const administrativeService = new AdministrativeService(connection);
    const gcNotifyService = new GCNotifyService(connection);
    try {
      await connection.open();

      const systemUserId = connection.systemUserId();

      if (!systemUserId) {
        throw new HTTP500('Failed to identify system user ID');
      }

      const response = await administrativeService.createAdministrativeActivity(systemUserId, req?.body);

      await connection.commit();

      await gcNotifyService.sendAccessRequestReceivedEmail();

      return res.status(200).json({ id: response.id, date: response.create_date });
    } catch (error) {
      defaultLog.error({ label: 'administrativeActivity', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

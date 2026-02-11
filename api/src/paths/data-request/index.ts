import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import {
  CreateDataRequestRequestSchema,
  DataRequestWithStatusResponseSchema
} from '../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { DataRequestService } from '../../services/data-request-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/data-request');

export const POST: Operation = [createDataRequest()];

POST.apiDoc = {
  description: 'Create a new data request',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateDataRequestRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Data request created successfully',
      content: {
        'application/json': {
          schema: DataRequestWithStatusResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Creates a new data request.
 *
 * @returns {RequestHandler}
 */
export function createDataRequest(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { team_id: teamId, reason } = req.body;

      const dataRequestService = new DataRequestService(connection);

      const dataRequest = await dataRequestService.createDataRequest(teamId, systemUserId, { reason });

      await connection.commit();

      res.status(201).json(dataRequest);
    } catch (error) {
      defaultLog.error({ label: 'createDataRequest', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

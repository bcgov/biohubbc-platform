import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { DatasetService } from '../../../services/dataset-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dataset/{datasetId}');

export const GET: Operation = [getDatasetInformation()];

GET.apiDoc = {
  description: 'retrieves dataset data from the submission table',
  tags: ['eml'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'dataset uuid',
      in: 'path',
      name: 'datasetId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Dataset metadata response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object'
            //TODO: add schema
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves dataset data from the submission table.
 *
 * @returns {RequestHandler}
 */
export function getDatasetInformation(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const datasetId = String(req.params.datasetId);

    try {
      await connection.open();

      const datasetService = new DatasetService(connection);

      const result = await datasetService.getDatasetByDatasetUUID(datasetId);

      await connection.commit();

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getMetadataByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

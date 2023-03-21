import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { ArtifactService } from '../../../../services/artifact-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [getArtifactsByDatasetId()];

GET.apiDoc = {
  description: 'Retrieves dataset artifact records by dataset ID',
  tags: ['artifacts'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'Dataset identifier',
      in: 'path',
      name: 'datasetId',
      schema: {
        type: 'string'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Dataset attachments response object.',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {
                type: 'object'
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retrieves dataset artifacts
 *
 * @returns {RequestHandler}
 */
export function getArtifactsByDatasetId(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token']
        ? getDBConnection(req['keycloak_token'])
        : getAPIUserDBConnection();

    const datasetId = String(req.params.datasetId);

    try {
      await connection.open();

      const artifactService = new ArtifactService(connection);

      const response = await artifactService.getArtifactsByDatasetId(datasetId);

      await connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getArtifactsByDatasetId', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

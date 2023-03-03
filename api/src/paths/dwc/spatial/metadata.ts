import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/spatial/metadata');

export const GET: Operation = [getSpatialMetadataBySubmissionSpatialComponentIds()];

GET.apiDoc = {
  description: 'Retrieves spatial component metadata based on submission spatial component id',
  tags: ['spatial'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      description: 'spatial component submission ids',
      in: 'query',
      name: 'submissionSpatialComponentIds',
      schema: {
        type: 'array',
        items: {
          type: 'number',
          minimum: 1
        }
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Spatial metadata response object.',
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
 * Retrieves dataset metadata from Elastic Search.
 *
 * @returns {RequestHandler}
 */
export function getSpatialMetadataBySubmissionSpatialComponentIds(): RequestHandler {
  return async (req, res) => {
    const submissionSpatialComponentIds = ((req.query.submissionSpatialComponentIds || []) as string[]).map(Number);

    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds(
        submissionSpatialComponentIds
      );

      await connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getSpatialMetadataBySubmissionSpatialComponentIds', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

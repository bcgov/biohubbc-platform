import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [getSpatialMetadataByIds()];

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
            /*
            type: 'array',
            items: {
              type: 'object',
              properties: {}
            }
            */
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
export function getSpatialMetadataByIds(): RequestHandler {
  return async (req, res) => {
    // console.log('req=', req)

    const submissionSpatialComponentIds = ((req.query.submissionSpatialComponentIds || []) as string[]).map((id) =>
      Number(id)
    );

    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);
      console.log(spatialService);

      const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentIds(
        submissionSpatialComponentIds
      );

      await connection.commit();

      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'getSpatialMetadataById', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
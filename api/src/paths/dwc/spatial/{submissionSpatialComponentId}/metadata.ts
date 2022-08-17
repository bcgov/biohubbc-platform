import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
// import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SpatialService } from '../../../../services/spatial-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [
  // authorizeRequestHandler(() => {
  //   return {
  //     and: [
  //       {
  //         discriminator: 'SystemUser'
  //       }
  //     ]
  //   };
  // }),
  getSpatialMetadataById()
];

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
      description: 'spatial component submission id',
      in: 'path',
      name: 'submissionSpatialComponentId',
      schema: {
        type: 'integer',
        minimum: 1
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
            type: 'object',
            properties: {}
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
export function getSpatialMetadataById(): RequestHandler {
  return async (req, res) => {
    const submissionSpatialComponentId = Number(req.params.submissionSpatialComponentId);

    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const response = await spatialService.findSpatialMetadataBySubmissionSpatialComponentId(
        submissionSpatialComponentId
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

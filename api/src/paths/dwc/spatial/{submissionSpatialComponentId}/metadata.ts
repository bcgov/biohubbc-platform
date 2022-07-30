import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SpatialService } from '../../../../services/spatial-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/get');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  getSpatialMetadataById()
];

GET.apiDoc = {
  description: 'retreives spatial component metadata based on submission id',
  tags: ['eml'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'spatial component submission id',
      in: 'query',
      name: 'submissionSpatialComponentId',
      required: false,
      schema: {
        type: 'string'
      }
    }
  ],
  responses: {
    200: {
      description: 'Spatial metadata response object.',
      content: {
        'application/json': {
          schema: {
            //
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Retreives dataset metadata from Elastic Search.
 *
 * @returns {RequestHandler}
 */
export function getSpatialMetadataById(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({
      label: 'getSpatialMetadataById',
      message: 'request params',
      submissionSpatialComponentId: req.params.submissionSpatialComponentId
    });

    const submissionSpatialComponentId = Number(req.params.submissionSpatialComponentId);

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const response = await spatialService.findSpatialMetadataBySubmissionId(submissionSpatialComponentId);

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

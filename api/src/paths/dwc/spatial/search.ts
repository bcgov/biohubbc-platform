import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

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
  searchSpatialComponents()
];

GET.apiDoc = {
  description: 'Searches for spatial components.',
  tags: ['search'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'type',
      required: false,
      schema: {
        type: 'array',
        items: {
          type: 'string'
        },
        maxItems: 1
      }
    }
  ],
  responses: {
    200: {
      description: 'Spatial components response object.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object'
                }
                // items: {
                //   ...(geoJsonFeature as object)
                // }
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function searchSpatialComponents(): RequestHandler {
  return async (req, res) => {
    const criteria = {
      type: req.query.type?.[0] || undefined
    };

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const response = await spatialService.findSpatialComponentsByCriteria(criteria);

      await connection.commit();

      res.status(200).json({ data: response });
    } catch (error) {
      defaultLog.error({ label: 'searchSpatialComponents', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

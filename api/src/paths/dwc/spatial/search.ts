import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
// import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

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
  searchSpatialComponents()
];

GET.apiDoc = {
  description: 'Searches for spatial components.',
  tags: ['search'],
  // security: [
  //   {
  //     Bearer: []
  //   }
  // ],
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
    },
    ...defaultErrorResponses
  }
};

export function searchSpatialComponents(): RequestHandler {
  return async (req, res) => {
    const criteria = {
      type: req.query.type?.[0] || undefined
    };

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      // @ts-ignore
      const response = await spatialService.findSpatialComponentsByCriteria(criteria);

      await connection.commit();

      res.status(200).json([
        {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                type: 'Boundary',
                id: 1
              },
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-123.45062255859374, 48.693679928847146],
                    [-123.475341796875, 48.68189420361741],
                    [-123.45611572265626, 48.66012869453836],
                    [-123.45611572265626, 48.64379839242537],
                    [-123.49044799804688, 48.62837047267327],
                    [-123.46984863281249, 48.59840868861914],
                    [-123.39157104492186, 48.575698529571355],
                    [-123.36685180664062, 48.58660067957586],
                    [-123.40667724609374, 48.675546901341384],
                    [-123.45062255859374, 48.693679928847146]
                  ]
                ]
              }
            },
            {
              type: 'Feature',
              properties: {
                type: 'Occurrence',
                id: 2,
                eventDate: '2022-06-24'
              },
              geometry: {
                type: 'Point',
                coordinates: [-123.42864990234375, 48.65559303004335]
              }
            },
            {
              type: 'Feature',
              properties: {
                type: 'Occurrence',
                id: 3,
                eventDate: '2022-06-25'
              },
              geometry: {
                type: 'Point',
                coordinates: [-123.43826293945311, 48.608397925562606]
              }
            }
          ]
        }
      ]);
    } catch (error) {
      defaultLog.error({ label: 'searchSpatialComponents', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { Feature } from 'geojson';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { GeoJSONFeatureCollection } from '../../../openapi/schemas/geoJson';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/spatial/search');

export const GET: Operation = [searchSpatialComponents()];

GET.apiDoc = {
  description: 'Searches for spatial components.',
  tags: ['spatial', 'search'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'boundary',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      description: 'A stringified GeoJSON Feature. Will return results that intersect the feature.'
    },
    {
      in: 'query',
      name: 'type',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        },
        nullable: true
      },
      description: 'An array of spatial component types to filter on. Will return results that match any of the types.'
    },
    {
      in: 'query',
      name: 'species',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        },
        nullable: true
      },
      description: 'An array of species codes to filter on. Will return results that match any of the types.'
    },
    {
      in: 'query',
      name: 'datasetID',
      schema: {
        type: 'array',
        items: {
          type: 'string'
        },
        nullable: true
      },
      description: 'An array of dataset IDs. Will return results that belong to any of the dataset IDs.'
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
              type: 'object',
              required: ['submission_spatial_component_ids', 'spatial_data'],
              properties: {
                submission_spatial_component_ids: {
                  type: 'array',
                  items: {
                    type: 'number',
                    minimum: 1
                  }
                },
                spatial_data: {
                  oneOf: [
                    {
                      ...GeoJSONFeatureCollection
                    },
                    {
                      type: 'object',
                      properties: {},
                      additionalProperties: false,
                      minProperties: 0,
                      maxProperties: 0,
                      description:
                        'An empty object, representing a spatial component the requester does not have sufficient privileges to view.'
                    }
                  ]
                }
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
    const boundaries: Feature[] = [];
    if (req.query.boundary?.length) {
      const boundariesArray: string[] = req.query.boundary as string[];
      boundariesArray.forEach((boundary) => {
        boundaries.push(JSON.parse(boundary));
      });
    }

    const criteria = {
      type: (req.query.type as string[]) || [],
      species: (req.query.species as string[]) || [],
      datasetID: (req.query.datasetID as string[]) || [],
      boundary: boundaries
    };

    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const response = await spatialService.findSpatialComponentsByCriteria(criteria);

      await connection.commit();

      res.status(200).json(
        response.map((row) => {
          const { submission_spatial_component_ids, spatial_component } = row;
          const { spatial_data, ...rest } = spatial_component
          return {
            submission_spatial_component_ids,
            ...rest,
            spatial_data: {
              ...spatial_data,
              features: spatial_data.features.map((feature) => {
                delete feature?.properties?.dwc;
                return feature;
              })
            }
          };
        })
      );
    } catch (error) {
      defaultLog.error({ label: 'searchSpatialComponents', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

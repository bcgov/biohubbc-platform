import { RequestHandler } from "express";
import { Operation } from "express-openapi";
import { Feature } from 'geojson';
import { getAPIUserDBConnection, getDBConnection } from "../../../database/db";
import { GeoJSONFeatureCollection } from "../../../openapi/schemas/geoJson";
import { defaultErrorResponses } from "../../../openapi/schemas/http-responses";
import { SpatialService } from "../../../services/spatial-service";
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/download');

export const GET: Operation = [downloadSpatialComponents()];

GET.apiDoc = {
    description: '',
    tags: [],
    security: [],
    parameters: [],
    responses: {
        200: {
          description: 'Spatial components response object.',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['submission_spatial_component_id', 'spatial_data'],
                  properties: {
                    submission_spatial_component_id: {
                      type: 'integer',
                      minimum: 1
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

export function downloadSpatialComponents(): RequestHandler {
    return async (req, res) => {
        const criteria = {
            type: (req.query.type as string[]) || [],
            datasetID: (req.query.datasetID as string[]) || [],
            boundary: JSON.parse(req.query.boundary as string) as Feature
        };

        // what happens if the endpoint is hit without a dataset ID?
        
        console.log("--- THE NEW HOTNESS DOWNLOAD SPATIAL COMPONENTS ---")

        const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

        try {
            await connection.open();
            
            const spatialService = new SpatialService(connection);

            const response = await spatialService.findSpatialComponentsByCriteria(criteria);

            await connection.commit();

            res.status(200).json(response.map((item) => item.spatial_component));
        } catch (error) {
            defaultLog.error({ label: 'downloadSpatialComponents', message: 'error', error})
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}
import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { Feature } from 'geojson';
import { getAPIUserDBConnection } from '../../../database/db';
import { GeoJSONFeatureCollection } from '../../../openapi/schemas/geoJson';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/search');

export const GET: Operation = [searchSpatialComponents()];

export enum SPATIAL_COMPONENT_TYPE {
  OCCURRENCE = 'Occurrence',
  BOUNDARY = 'Boundary'
}

const getAllSpatialComponentTypes = (): string[] => Object.values(SPATIAL_COMPONENT_TYPE);

GET.apiDoc = {
  description: 'Searches for spatial components.',
  tags: ['search'],
  parameters: [
    {
      in: 'query',
      name: 'type',
      required: true,
      schema: {
        type: 'array',
        items: {
          type: 'string',
          enum: getAllSpatialComponentTypes()
        }
      }
    },
    {
      in: 'query',
      name: 'boundary',
      required: true,
      schema: {
        type: 'string'
      },
      description: 'A stringified GeoJSON Feature.'
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
              ...GeoJSONFeatureCollection
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
      type: (req.query.type as string[]) || [],
      boundary: JSON.parse(req.query.boundary as string) as Feature
    };

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const spatialService = new SpatialService(connection);

      const { count } = await spatialService.getSpatialComponentsCountByCriteria(criteria);

      let response;

      if (count > 500) {
        // TODO WIP cluster example - investigate GeoServer as alternative option
        response = await spatialService.findSpatialComponentsByCriteriaWithClustering(criteria);
      } else {
        response = await spatialService.findSpatialComponentsByCriteria(criteria);
      }

      await connection.commit();

      res.status(200).json(response.map((item) => item.spatial_component));
    } catch (error) {
      defaultLog.error({ label: 'searchSpatialComponents', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

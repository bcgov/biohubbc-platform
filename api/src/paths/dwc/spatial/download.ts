import AdmZip from 'adm-zip';
import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { Feature } from 'geojson';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { SpatialService } from '../../../services/spatial-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/spatial/download');

export const GET: Operation = [downloadSpatialComponents()];

GET.apiDoc = {
  description: 'Archived search results for spatial components.',
  tags: ['spatial', 'search', 'download'],
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
      name: 'datasetID',
      required: true,
      schema: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      description: 'An array of dataset IDs. Will return results that belong to any of the dataset IDs.'
    }
  ],
  responses: {
    200: {
      description: 'Archived spatial components response object.',
      content: {
        'application/zip': {
          schema: {
            type: 'string',
            description: 'Buffer of the arcived search results.'
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function downloadSpatialComponents(): RequestHandler {
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
      datasetID: (req.query.datasetID as string[]) || [],
      boundary: boundaries
    };

    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    try {
      await connection.open();
      const spatialService = new SpatialService(connection);
      const response = await spatialService.findSpatialComponentsByCriteria(criteria);

      const zip = new AdmZip();
      const fileName = `results.json`;

      zip.addFile(fileName, Buffer.from(JSON.stringify(response)), 'Search results.');
      const zipToSend = await zip.toBuffer();

      await connection.commit();

      // encoding zip as hex to avoid corrupted file in response
      res.status(200).send(zipToSend.toString('hex'));
    } catch (error) {
      defaultLog.error({ label: 'downloadSpatialComponents', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import AdmZip from "adm-zip";
import { RequestHandler } from "express";
import { Operation } from "express-openapi";
import { Feature } from 'geojson';
import { getAPIUserDBConnection, getDBConnection } from "../../../database/db";
import { defaultErrorResponses } from "../../../openapi/schemas/http-responses";
import { SpatialService } from "../../../services/spatial-service";
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/eml/download');

export const GET: Operation = [downloadSpatialComponents()];

GET.apiDoc = {
    description: '',
    tags: [],
    security: [],
    parameters: [
        {
          in: 'query',
          name: 'boundary',
          required: true,
          schema: {
            type: 'string'
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
          description: '',
          content: {
            'application/zip': {
                schema: {
                    type: "string"
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
        // naming convention for the zip file? does it matter?
        // mentions public user, what is that compared to a private user? logging in?
        // how can I setup my data so things are public/ private
        // is there a particular browser we need to target?

        // download button built into map: https://www.npmjs.com/package/react-leaflet-easyprint
        const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

        try {
            await connection.open();
            const spatialService = new SpatialService(connection);
            const response = await spatialService.findSpatialComponentsByCriteria(criteria);
            await connection.commit();

            const zip = new AdmZip();
            const fileName = "data.json";
            
            zip.addFile(fileName, Buffer.from(JSON.stringify(response)), "Making a file");
            const zipToSend = await zip.toBuffer()

            res.set({
                'Content-Length': Buffer.byteLength(zipToSend),
                'Content-Type': 'application/zip',
                'Content-Disposition': `attached; filename="${fileName}"`
            })
            
            res.status(200).send(zipToSend.toString("hex"))
        } catch (error) {
            defaultLog.error({ label: 'downloadSpatialComponents', message: 'error', error})
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}
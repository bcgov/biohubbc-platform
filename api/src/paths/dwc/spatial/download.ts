import AdmZip from "adm-zip";
import { RequestHandler } from "express";
import { Operation } from "express-openapi";
// import { Feature } from 'geojson';
import { getAPIUserDBConnection, getDBConnection } from "../../../database/db";
// import { GeoJSONFeatureCollection } from "../../../openapi/schemas/geoJson";
import { defaultErrorResponses } from "../../../openapi/schemas/http-responses";
// import { SpatialService } from "../../../services/spatial-service";
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
          description: '',
          content: {
            'application/zip': {}
          }
        },
        ...defaultErrorResponses
      }
};

export function downloadSpatialComponents(): RequestHandler {
    return async (req, res) => {
        // const criteria = {
        //     type: (req.query.type as string[]) || [],
        //     datasetID: (req.query.datasetID as string[]) || [],
        //     boundary: JSON.parse(req.query.boundary as string) as Feature
        // };

        // what happens if the endpoint is hit without a dataset ID?
        // naming convention for the zip file? does it matter?
        // mentions public user, what is that compared to a private user? logging in?
        // how can I setup my data so things are public/ private
        // is there a particular browser we need to target?

        // download button built into map: https://www.npmjs.com/package/react-leaflet-easyprint

        console.log("--- THE NEW HOTNESS DOWNLOAD SPATIAL COMPONENTS ---")

        const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

        try {
            await connection.open();
            // const spatialService = new SpatialService(connection);
            // const response = await spatialService.findSpatialComponentsByCriteria(criteria);

            /*
            app.get('/download', (request, response) => {
            const fileData = 'SGVsbG8sIFdvcmxkIQ=='
            const fileName = 'hello_world.txt'
            const fileType = 'text/plain'

            response.writeHead(200, {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': fileType,
            })

            const download = Buffer.from(fileData, 'base64')
            response.end(download)
            })
            */

            await connection.commit();

            const zip = new AdmZip();
            zip.addFile(Date.now() + '.json', Buffer.from(JSON.stringify({msg: "Look at this bad boii"})));
            const zipToSend = zip.toBuffer();

            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attached; filename="download.zip"`
            })

            res.end(zipToSend)
        } catch (error) {
            defaultLog.error({ label: 'downloadSpatialComponents', message: 'error', error})
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}
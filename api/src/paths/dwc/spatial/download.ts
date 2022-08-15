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
        console.log("________ NEW HOTNESS _______")
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
        const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

        try {
            await connection.open();
            // const spatialService = new SpatialService(connection);
            // const response = await spatialService.findSpatialComponentsByCriteria(criteria);
            // await connection.commit();

            const zip = new AdmZip();
            const content = "inner content of the file";
            zip.addFile("test.txt", Buffer.from(content, "utf8"), "entry comment goes here");
            const zipToSend = zip.toBuffer();

            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attached; filename="test.zip"`
            })
            // get everything as a buffer
            // var willSendthis = zip.toBuffer();
            // or write everything to disk
            // zip.writeZip("./test.zip");
            res.end(zipToSend);
        } catch (error) {
            defaultLog.error({ label: 'downloadSpatialComponents', message: 'error', error})
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}
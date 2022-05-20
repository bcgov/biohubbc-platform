import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DarwinCoreService } from '../../../services/dwc-service';
import { scanFileForVirus } from '../../../utils/file-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/dataset/create');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  submitDataset()
];

POST.apiDoc = {
  description: 'Submit a new Darwin Core Archive (DwCA) data package.',
  tags: ['dwc'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          required: ['media'],
          properties: {
            media: {
              type: 'string',
              format: 'binary',
              description:
                'A Darwin Core Archive (DwCA) data package. A zipped archive that must contain the following files: `eml.xml`, `event.csv`, `occurrence.csv`, `taxon.csv`, and can optionally include: `measurementorfact.csv`, `resourcerelationship.csv`, `meta.xml`.'
            },
            data_package_id: {
              type: 'string',
              format: 'uuid',
              description:
                'The unique identifier for this Darwin Core Archive (DwCA) data package. If one is not provided, one will be generated.'
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Submission OK.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['data_package_id'],
            properties: {
              data_package_id: {
                type: 'string',
                format: 'uuid',
                description: 'The unique identifier this Darwin Core Archive (DwCA) data package.'
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function submitDataset(): RequestHandler {
  return async (req, res) => {
    if (!req?.files?.length) {
      throw new HTTP400('Missing required `media`');
    }

    const file: Express.Multer.File = req.files[0];

    if (!(await scanFileForVirus(file))) {
      throw new HTTP400('Malicious content detected, upload cancelled');
    }

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const darwinCoreService = new DarwinCoreService(connection);

      const { dataPackageId, submissionId } = await darwinCoreService.ingestNewDwCADataPackage(file);

      // return after creating the submission
      res.status(200).json({ data_package_id: dataPackageId });

      //call the new function from here (input: submission id)

      await darwinCoreService.scrapeAndUploadOccurrences(submissionId);

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'submitDataset', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

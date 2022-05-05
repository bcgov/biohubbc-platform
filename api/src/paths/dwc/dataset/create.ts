import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { v4 as uuidv4 } from 'uuid';
import { getDBConnection } from '../../../database/db';
import { ApiGeneralError } from '../../../errors/api-error';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DarwinCoreService } from '../../../services/dwc-service';
import { SubmissionService } from '../../../services/submission-service';
import { generateS3FileKey, scanFileForVirus, uploadFileToS3 } from '../../../utils/file-utils';
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
    if (!req.files || !req.files.length) {
      throw new HTTP400('Missing required `media`');
    }

    const unknownMedia: Express.Multer.File = req.files[0];

    const dataPackageId = req.body.data_package_id || uuidv4();

    if (!(await scanFileForVirus(unknownMedia))) {
      throw new HTTP400('Malicious content detected, upload cancelled');
    }

    const connection = getDBConnection(req['keycloak_token']);

    try {
      const darwinCoreService = new DarwinCoreService(connection);

      let dwcArchive;
      try {
        dwcArchive = darwinCoreService.prepDWCArchive(unknownMedia);
      } catch (error) {
        throw new HTTP400((error as ApiGeneralError).message, (error as ApiGeneralError).errors);
      }

      await connection.open();

      const submissionService = new SubmissionService(connection);

      const response = await submissionService.insertSubmissionRecord({
        source: 'SIMS', // TODO temporarily hardcoded
        input_file_name: dwcArchive.rawFile.fileName,
        input_key: '',
        event_timestamp: new Date().toISOString(),
        eml_source: dwcArchive.extra.eml,
        darwin_core_source: '{}', // TODO populate
        uuid: dataPackageId
      });

      const submissionId = response.submission_id;

      if (!submissionId) {
        throw new HTTP400('Failed to insert submission record', ['submissionId was null or undefined']);
      }

      const s3Key = generateS3FileKey({
        submissionId: submissionId,
        fileName: unknownMedia.originalname
      });

      await submissionService.updateSubmissionRecordInputKey(submissionId, s3Key);

      await uploadFileToS3(unknownMedia, s3Key, {
        filename: unknownMedia.originalname
      });

      await connection.commit();

      res.status(200).json({ data_package_id: dataPackageId });
    } catch (error) {
      defaultLog.error({ label: 'submitDataset', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

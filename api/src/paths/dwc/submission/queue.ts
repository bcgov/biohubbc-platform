import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
// import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionJobQueueService } from '../../../services/submission-job-queue-service';
import { scanFileForVirus } from '../../../utils/file-utils';
import { getKeycloakSource } from '../../../utils/keycloak-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/queue');

// TODO: does this need security?
export const POST: Operation = [
  queueForProcess()
];

POST.apiDoc = {
  description: 'Submit DwCA to be queued and processed',
  tags: ['dwca'],
  security: [
  ],
  requestBody: {
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          required: ['media', 'dataset_uuid'],
          properties: {
            media: {
              type: 'string',
              format: 'binary',
              description: 'A Darwin Core ARchive (DwCA) data package.'
            },
            dataset_uuid: {
              type: 'string',
              format: 'uuid',
              description: 'A unique identifier for this Darwin Care Archive (DwCA) data package.'
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Submission OK',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['queue_id'],
            properties: {
              queue_id: {
                type: 'integer',
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function queueForProcess(): RequestHandler {
  return async (req, res) => {
    console.log("New API running")
    // above apiDoc checks for this already
    const file: Express.Multer.File = req.files![0];
    console.log(Object.keys(req))
    const sourceSystem = getKeycloakSource(req['keycloak_token']);
    console.log(sourceSystem)
    console.log(req.files);
    if (!(await scanFileForVirus(file))) {
      throw new HTTP400('Malicious content detected, upload cancelled');
    }

    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const id = req.body.dataset_uuid;
    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();

      const service = new SubmissionJobQueueService(connection);
      await service.intake(id, file);
      await connection.commit();
      res.status(200).json({queue_id: 1});
    } catch (error) {
      defaultLog.error({ label: 'intakeDataset', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

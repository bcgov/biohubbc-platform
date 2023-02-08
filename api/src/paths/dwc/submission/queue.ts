import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../../constants/database';
import { getServiceAccountDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionJobQueueService } from '../../../services/submission-job-queue-service';
import { scanFileForVirus } from '../../../utils/file-utils';
import { getKeycloakSource } from '../../../utils/keycloak-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/queue');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validServiceClientIDs: [SOURCE_SYSTEM['SIMS-SVC-4464']],
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  queueForProcess()
];

POST.apiDoc = {
  description: 'Submit DwCA to be queued and processed',
  tags: ['dwca'],
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
            },
            security_request: {
              type: 'object',
              description: 'An object containing information for a security request.',
              properties: {
                first_nations_id: {
                  type: 'integer',
                  minimum: 1
                },
                proprietor_type_id: {
                  type: 'integer',
                  minimum: 1
                },
                survey_id: {
                  type: 'integer',
                  minimum: 1
                },
                rational: {
                  type: 'string'
                },
                proprietor_name: {
                  type: 'integer',
                  minimum: 1
                },
                disa_required: {
                  type: 'boolean',
                  nullable: true
                }
              }
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
                type: 'integer'
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
    if (!req.files?.length) {
      throw new HTTP400('Missing required `media`');
    }

    if (req.files?.length !== 1) {
      // no media objects included
      throw new HTTP400('Too many files uploaded, expected 1');
    }

    const file: Express.Multer.File = req.files![0];
    const sourceSystem = getKeycloakSource(req['keycloak_token']);

    if (!(await scanFileForVirus(file))) {
      throw new HTTP400('Malicious content detected, upload cancelled');
    }

    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const id = req.body.dataset_uuid;
    const securityRequest = req.body.security_request;
    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();
      const service = new SubmissionJobQueueService(connection);
      const queueRecord = await service.intake(id, file, securityRequest);
      await connection.commit();
      res.status(200).json(queueRecord);
    } catch (error) {
      defaultLog.error({ label: 'queueForProcess', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

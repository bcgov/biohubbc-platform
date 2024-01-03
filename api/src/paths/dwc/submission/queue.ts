import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ISecurityRequest, SubmissionJobQueueService } from '../../../services/submission-job-queue-service';
import { scanFileForVirus } from '../../../utils/file-utils';
import { getServiceClientSystemUser } from '../../../utils/keycloak-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/queue');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
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
          required: ['media', 'data_package_id'],
          properties: {
            media: {
              type: 'string',
              format: 'binary',
              description: 'A Darwin Core ARchive (DwCA) data package.'
            },
            data_package_id: {
              type: 'string',
              format: 'uuid',
              description: 'A unique identifier for this Darwin Care Archive (DwCA) data package.'
            },
            security_request: {
              type: 'object',
              description: 'An object containing information for a security request.',
              required: ['first_nations_id', 'proprietor_type_id', 'survey_id', 'rational', 'proprietor_name'],
              properties: {
                first_nations_id: {
                  type: 'string'
                },
                proprietor_type_id: {
                  type: 'string'
                },
                survey_id: {
                  type: 'string'
                },
                rational: {
                  type: 'string'
                },
                proprietor_name: {
                  type: 'string'
                },
                disa_required: {
                  type: 'string',
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

    let securityRequest: ISecurityRequest | undefined;
    if (req.body.security_request) {
      const first_nations_id = Number(req.body.security_request.first_nations_id);
      if (isNaN(first_nations_id) || first_nations_id < 0) {
        throw new HTTP400('First nations id is a required field');
      }

      const proprietor_type_id = Number(req.body.security_request.proprietor_type_id);
      if (isNaN(proprietor_type_id) || proprietor_type_id < 0) {
        throw new HTTP400('Proprietor type id is a required field');
      }

      const survey_id = Number(req.body.security_request.survey_id);
      if (isNaN(survey_id) || survey_id < 0) {
        throw new HTTP400('Survey id is a required field');
      }

      const rational = req.body.security_request.rational;
      if (!rational && rational !== '') {
        throw new HTTP400('Rational is a required field');
      }

      const proprietor_name = req.body.security_request.proprietor_name;
      if (!proprietor_name && proprietor_name !== '') {
        throw new HTTP400('Proprietor name is a required field');
      }

      const disa_required = !!req.body.security_request.disa_required;

      securityRequest = {
        first_nations_id,
        proprietor_type_id,
        survey_id,
        rational,
        proprietor_name,
        disa_required
      };
    }

    const file: Express.Multer.File = req.files[0];
    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!(await scanFileForVirus(file))) {
      throw new HTTP400('Malicious content detected, upload cancelled');
    }

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a sub or sub value is unknown'
      ]);
    }

    const id = req.body.data_package_id;
    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

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

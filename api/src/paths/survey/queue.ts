import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { SUBMISSION_MESSAGE_TYPE, SUBMISSION_STATUS_TYPE } from '../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SubmissionService } from '../../services/submission-service';
import { getKeycloakSource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/survey/queue');

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
  description: 'Submit Survey Id to be queued and processed',
  tags: ['survey'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['uuid', 'surveyId', 'additionalInformation'],
          properties: {
            uuid: {
              type: 'string',
              description: 'UUID'
            },
            surveyId: {
              type: 'number',
              description: 'Survey Id'
            },
            additionalInformation: {
              type: 'string',
              description: 'Additional Information'
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
            required: ['submission_id'],
            properties: {
              submission_id: {
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
    const sourceSystem = getKeycloakSource(req['keycloak_token']);

    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const uuid = req.body.uuid;
    const additionalInformation = req.body.additionalInformation;

    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const response = await submissionService.insertSubmissionRecordWithPotentialConflict({
        uuid: uuid,
        source_transform_id: 1
      });

      await submissionService.insertSubmissionStatusAndMessage(
        response.submission_id,
        SUBMISSION_STATUS_TYPE.PUBLISHED,
        SUBMISSION_MESSAGE_TYPE.NOTICE,
        additionalInformation
      );

      await connection.commit();
      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'queueForProcess', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

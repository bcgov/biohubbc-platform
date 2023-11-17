import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
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
          required: ['surveyId', 'additionalInformation'],
          properties: {
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
    const sourceSystem = getKeycloakSource(req['keycloak_token']);

    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const id = req.body.surveyId;
    const additionalInformation = req.body.additionalInformation;
    console.log('id', id);
    console.log('additionalInformation', additionalInformation);

    // const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      // await connection.open();

      // const service = new SubmissionJobQueueService(connection);
      // const queueRecord = await service.intake(id, file, );

      // await connection.commit();
      res.status(200).json({ queue_id: 1 });
    } catch (error) {
      defaultLog.error({ label: 'queueForProcess', message: 'error', error });
      // await connection.rollback();
      throw error;
    } finally {
      // connection.release();
    }
  };
}

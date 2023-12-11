import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SubmissionService } from '../../services/submission-service';
import { ValidationService } from '../../services/validation-service';
import { getKeycloakSource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/submission/intake');

/*
TODO: UPDATED PATH TO SUBMISSION/INTAKE NEED TO UPDATE SIMS TO USE THIS PATH
*/

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
  submissionIntake()
];

POST.apiDoc = {
  description: 'Submit submission to BioHub',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: {
          title: 'BioHub Data Submission',
          type: 'object',
          required: ['id', 'type', 'properties', 'features'],
          properties: {
            id: {
              title: 'Unique id of the submission',
              type: 'string'
            },
            type: {
              type: 'string',
              enum: ['submission']
            },
            properties: {
              title: 'Dataset properties',
              type: 'object',
              properties: {}
            },
            features: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SubmissionFeature'
              },
              additionalProperties: false
            }
          },
          additionalProperties: false
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

export function submissionIntake(): RequestHandler {
  return async (req, res) => {
    const sourceSystem = getKeycloakSource(req['keycloak_token']);

    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const submission = {
      ...req.body,
      properties: { ...req.body.properties, additionalInformation: req.body.properties.additionalInformation }
    };
    const id = req.body.id;

    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);
      const validationService = new ValidationService(connection);

      // validate the submission submission
      if (!(await validationService.validateDatasetSubmission(submission))) {
        throw new HTTP400('Invalid submission submission');
      }

      // insert the submission record
      const response = await submissionService.insertSubmissionRecordWithPotentialConflict(id);

      // insert each submission feature record
      await submissionService.insertSubmissionFeatureRecords(response.submission_id, submission.features);

      await connection.commit();
      res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'submissionIntake', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { ISubmissionFeature } from '../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SearchIndexService } from '../../services/search-index-service';
import { SubmissionService } from '../../services/submission-service';
import { ValidationService } from '../../services/validation-service';
import { getKeycloakSource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/submission/intake');

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
          required: ['id', 'name', 'description', 'features'],
          properties: {
            id: {
              title: 'Unique id of the submission',
              type: 'string'
            },
            name: {
              title: 'The name of the submission. Should not include sensitive information.',
              type: 'string',
              maxLength: 200
            },
            description: {
              title: 'A description of the submission. Should not include sensitive information.',
              type: 'string',
              maxLength: 3000
            },
            features: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SubmissionFeature'
              },
              maxItems: 1,
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
      id: req.body.id,
      name: req.body.name,
      description: req.body.description
    };

    const submissionFeatures: ISubmissionFeature[] = req.body.features;

    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);
      const validationService = new ValidationService(connection);
      const searchIndexService = new SearchIndexService(connection);

      // validate the submission
      if (!(await validationService.validateSubmissionFeatures(submissionFeatures))) {
        throw new HTTP400('Invalid submission');
      }

      // insert the submission record
      const response = await submissionService.insertSubmissionRecordWithPotentialConflict(
        submission.id,
        submission.name,
        submission.description
      );

      // insert each submission feature record
      await submissionService.insertSubmissionFeatureRecords(response.submission_id, submissionFeatures);

      // Index the submission feature record properties
      await searchIndexService.indexFeaturesBySubmissionId(response.submission_id);

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

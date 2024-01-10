import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { ISubmissionFeature } from '../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SearchIndexService } from '../../services/search-index-service';
import { SubmissionService } from '../../services/submission-service';
import { ValidationService } from '../../services/validation-service';
import { getServiceClientSystemUser } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/submission/intake');

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
  submissionIntake()
];

POST.apiDoc = {
  description: 'Submit data to BioHub',
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
              description: 'Unique id of the submission.',
              type: 'string'
            },
            name: {
              description: 'The name of the submission. Should not include sensitive information.',
              type: 'string',
              maxLength: 200
            },
            description: {
              description: 'A description of the submission. Should not include sensitive information.',
              type: 'string',
              maxLength: 3000
            },
            features: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SubmissionFeature'
              },
              minItems: 1,
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
              submission_uuid: {
                description: 'Unique id of the submission.',
                type: 'string',
                format: 'uuid'
              },
              artifact_upload_keys: {
                description:
                  'Contains information required by the artifact intake endpoint, which is used to upload artifact files to BioHub.',
                type: 'array',
                items: {
                  type: 'object',
                  required: ['artifact_filename', 'artifact_upload_key'],
                  properties: {
                    artifact_filename: {
                      description: 'The original file name of the artifact, including the extension.',
                      type: 'string'
                    },
                    artifact_upload_key: {
                      description:
                        'The artifact upload key. Use this key in the subsequent requests to upload the actual artifact file.',
                      type: 'string'
                    }
                  },
                  additionalProperties: false
                }
              }
            },
            additionalProperties: false
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function submissionIntake(): RequestHandler {
  return async (req, res) => {
    // TODO Allow system admins
    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a sub or sub value is unknown'
      ]);
    }

    const submissionSourceId = req.body.id;
    const submissionName = req.body.name;
    const submissionDescription = req.body.description;

    const submissionFeatures: ISubmissionFeature[] = req.body.features;

    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

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
      const submissionRecord = await submissionService.insertSubmissionRecordWithPotentialConflict(
        submissionSourceId,
        submissionName,
        submissionDescription,
        serviceClientSystemUser.user_identifier
      );

      // insert each submission feature record
      await submissionService.insertSubmissionFeatureRecords(submissionRecord.submission_id, submissionFeatures);

      // Index the submission feature record properties
      await searchIndexService.indexFeaturesBySubmissionId(submissionRecord.submission_id);

      // Fetch all artifact submission features, if any
      const submissionArtifactFeatures = await submissionService.findSubmissionFeatures({
        submissionId: submissionRecord.submission_id,
        featureTypeNames: ['artifact']
      });

      await connection.commit();

      const response = {
        submission_uuid: submissionRecord.uuid,
        // Include artifact upload keys in response, if any
        ...(submissionArtifactFeatures.length && {
          artifact_upload_keys: submissionArtifactFeatures.map((item) => {
            return {
              artifact_filename: item.data['filename'],
              artifact_upload_key: item.uuid
            };
          })
        })
      };

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

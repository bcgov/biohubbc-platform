import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../database/db';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { ISubmissionFeature } from '../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { RegionService } from '../../services/region-service';
import { SubmissionProcessService } from '../../services/submission-process-service';
import { SubmissionService } from '../../services/submission-service';
import { ValidationService } from '../../services/validation-service';
import { getServiceClientSystemUser } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/submission/intake');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      or: [
        {
          discriminator: 'ServiceClient'
        },
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
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
          required: ['id', 'name', 'description', 'comment', 'content'],
          properties: {
            id: {
              description: 'The Unique identifier of the submission as supplied by the source system.',
              format: 'uuid',
              type: 'string'
            },
            name: {
              description: 'The name of the submission. Should not include sensitive information.',
              type: 'string',
              maxLength: 200
            },
            description: {
              description:
                'A description of the submission. Should not include sensitive information. May be shared with the general public.',
              type: 'string',
              maxLength: 3000
            },
            comment: {
              description:
                'An internal comment/description of the submission for administrative purposes. May include sensitive information. Will never be shared with the general public.',
              type: 'string',
              maxLength: 3000
            },
            content: {
              $ref: '#/components/schemas/SubmissionFeature'
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
            required: ['submission_uuid'],
            properties: {
              submission_uuid: {
                description: 'Globally unique id of the submission as assigned by BioHub.',
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

/**
 * NOTE: This endpoint will be deprecated in favour of the quarantine workflow in the POST api/submission/quarantine endpoint
 *
 */
export function submissionIntake(): RequestHandler {
  return async (req, res) => {
    const token = req['keycloak_token'];

    const serviceClientSystemUser = getServiceClientSystemUser(token);

    const connection = serviceClientSystemUser
      ? getServiceAccountDBConnection(serviceClientSystemUser)
      : getDBConnection(token);

    const submissionUuid = req.body.id;
    const submissionName = req.body.name;
    const submissionDescription = req.body.description;
    const submissionComment = req.body.comment;

    const submissionFeature: ISubmissionFeature = req.body.content;

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);
      const submissionProcessService = new SubmissionProcessService(connection);
      const validationService = new ValidationService(connection);
      const regionService = new RegionService(connection);

      // Validate the submission features directly from the request body
      await validationService.validateSubmissionFeatureShape(submissionFeature);

      // Insert the submission record
      const submissionRecord = await submissionService.insertSubmissionRecordWithPotentialConflict({
        quarantine_id: null,
        uuid: submissionUuid,
        name: submissionName,
        comment: submissionComment,
        description: submissionDescription,
        system_user_id: req['system_user'].system_user_id,
        // TODO: Replace source_system string with a FK to the `contributor` table added in SIMSBIOHUB-782, which uses the JWTs client_id to identify SIMS
        source_system: 'SIMS'
      });

      // Process submission features (insert into DB and index search keys)
      await submissionProcessService._processSubmissionFeatures(submissionRecord.submission_id, [submissionFeature]);

      // Fetch all artifact submission features, if any
      const submissionArtifactFeatures = await submissionService.findSubmissionFeatures({
        submissionId: submissionRecord.submission_id,
        featureTypeNames: ['artifact']
      });

      // Calculate and add submission regions
      await regionService.calculateAndAddRegionsForSubmission(submissionRecord.submission_id, 0.3);

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

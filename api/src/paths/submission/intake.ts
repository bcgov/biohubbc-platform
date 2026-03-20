import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { UploadStatusEnum } from '../../models/upload';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { ISubmissionFeature } from '../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { RegionService } from '../../services/region-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { SubmissionService } from '../../services/submission-service';
import { SubmissionUploadService } from '../../services/upload/submission-upload-service';
import { UploadService } from '../../services/upload/upload-service';
import { ValidationService } from '../../services/validation-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/submission/intake');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    or: [{ discriminator: 'Contributor' }]
  })),
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
            required: ['submission_id', 'submission_uuid'],
            properties: {
              submission_id: {
                description: 'The unique identifier of the submission record in the database.',
                type: 'integer',
                minimum: 1
              },
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

export function submissionIntake(): RequestHandler {
  return async (req, res) => {
    const submissionUuid = req.body.id;
    const submissionName = req.body.name;
    const submissionDescription = req.body.description;
    const submissionComment = req.body.comment;
    const contributorId = req.contributor_id!;

    const submissionFeature: ISubmissionFeature = req.body.content;

    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const system_user_id = req.system_user!.system_user_id;

      const submissionService = new SubmissionService(connection);
      const validationService = new ValidationService(connection);
      const searchFeatureService = new SearchFeatureService(connection);
      const regionService = new RegionService(connection);

      // validate the submission
      if (!(await validationService.validateSubmissionFeatures([submissionFeature]))) {
        throw new HTTP400('Invalid submission'); // TODO return details on why the submission is invalid
      }

      // insert the submission record
      const submissionRecord = await submissionService.insertSubmissionRecordWithPotentialConflict(
        submissionUuid,
        submissionName,
        submissionDescription,
        submissionComment,
        system_user_id,
        contributorId
      );

      /*
      Added to make backward compatible.
      Assumption is this code is legacy and will not run and will be removed.
      */
      const uploadService = new UploadService(connection);
      const { upload_id } = await uploadService.insertUpload({
        upload_status: UploadStatusEnum.COMPLETED,
        record_end_date: new Date().toISOString(),
        s3_upload_id: ''
      });

      // Create submission_upload bridge record (required for submission_upload_id FK on features)
      const submissionUploadService = new SubmissionUploadService(connection);
      const { submission_upload_id } = await submissionUploadService.insertSubmissionUpload({
        submission_id: submissionRecord.submission_id,
        upload_id
      });

      // insert each submission feature record
      await submissionService.insertSubmissionFeatureRecords(submissionRecord.submission_id, submission_upload_id, [
        submissionFeature
      ]);

      // Index the submission feature record properties
      await searchFeatureService.indexFeaturesBySubmissionId(submissionRecord.submission_id);

      // Fetch all artifact submission features, if any
      const submissionArtifactFeatures = await submissionService.findSubmissionFeatures({
        submissionId: submissionRecord.submission_id,
        featureTypeNames: ['artifact', 'file', 'report']
      });

      // Calculate and add submission regions
      await regionService.calculateAndAddRegionsForSubmission(submissionRecord.submission_id, 0.3);

      await connection.commit();

      const response = {
        submission_id: submissionRecord.submission_id,
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

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/artifact-service';
import { getServiceClientSystemUser } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/artifact/intake');

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
  intakeArtifact()
];

POST.apiDoc = {
  description: 'Submit an artifact to BioHub.',
  tags: ['submission', 'artifact'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'multipart/form-data': {
        schema: {
          title: 'BioHub Artifact Submission',
          description:
            'Allows source systems to upload artifacts to BioHub. The submission intake endpoint must be called first to generate a submission record against which artifacts may be submitted. Additionally, the original submission must include one artifact feature element for each artifact being uploaded to this endpoint.',
          type: 'object',
          required: ['submission_uuid', 'artifact_upload_key', 'media'],
          properties: {
            submission_uuid: {
              description:
                'Globally unique id of the submission as assigned by BioHub. A submission uuid is returned by the submission intake endpoint.',
              type: 'string',
              format: 'uuid'
            },
            artifact_upload_key: {
              description:
                'The artifact upload key. An upload key is returned by the submission intake endpoint for each artifact feature element included, if any.',
              type: 'string'
            },
            media: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  fieldname: { type: 'string' },
                  originalname: { type: 'string' },
                  encoding: { type: 'string' },
                  mimetype: { type: 'string' },
                  buffer: { type: 'object' },
                  size: { type: 'number' }
                }
              },
              description: 'The artifact files processed by multer.'
            }
          },
          additionalProperties: false
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Artifact OK.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['artifact_uuid'],
            properties: {
              artifact_uuid: {
                description: 'Globally unique id of the artifact feature element as assigned by BioHub.',
                type: 'string',
                format: 'uuid'
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

export function intakeArtifact(): RequestHandler {
  return async (req, res) => {
    if (!req.files?.length) {
      throw new HTTP400('Missing required `media`');
    }

    if (req.files?.length !== 1) {
      throw new HTTP400('Too many files uploaded, expected 1');
    }

    const file: Express.Multer.File = Object.values(req.files)[0];

    const artifactUploadKey = req.body.artifact_upload_key;

    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token sub did not match any known system user guid for a service client user'
      ]);
    }

    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

    try {
      await connection.open();

      const artifactService = new ArtifactService(connection);

      const artifactSubmissionFeature = await artifactService.uploadSubmissionFeatureArtifact(artifactUploadKey, file);

      res.status(200).json({ artifact_uuid: artifactSubmissionFeature.uuid });

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'intakeArtifact', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../services/submission-upload-service';
import { getServiceClientSystemUser } from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/quarantine/{quarantineId}');

export const PUT: Operation = [
  authorizeRequestHandler(() => {
    return {
      or: [
        {
          discriminator: 'ServiceClient'
        },
        {
          discriminator: 'SystemRole',
          validSystemRoles: [SYSTEM_ROLE.DATA_ADMINISTRATOR, SYSTEM_ROLE.SYSTEM_ADMIN]
        }
      ]
    };
  }),
  completeMultipartUploadHandler()
];

PUT.apiDoc = {
  description: 'Complete a multipart file upload for a submission',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      description: 'The quarantine ID that was returned when upload URLs were requested',
      in: 'path',
      name: 'quarantineId',
      schema: {
        type: 'string'
      },
      required: true
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          title: 'Complete Multipart Upload Request',
          type: 'object',
          required: ['uploadId', 'key', 'parts', 'metadata'],
          properties: {
            uploadId: {
              type: 'string',
              description: 'Upload ID that was returned when upload URLs were requested'
            },
            key: {
              type: 'string',
              description: 'The S3 object key for the uploaded file'
            },
            parts: {
              type: 'array',
              description: 'The list of uploaded parts with part number and ETag',
              items: {
                type: 'object',
                required: ['partNumber', 'etag'],
                properties: {
                  partNumber: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Part number of the uploaded part'
                  },
                  etag: {
                    type: 'string',
                    description: 'ETag returned from the part upload'
                  }
                },
                additionalProperties: false
              }
            },
            metadata: {
              type: 'object',
              description:
                'Metadata about the submissions, such as its display name and description, and comments for administrators',
              additionalProperties: false,
              required: ['name', 'description', 'comment', 'uid'],
              properties: {
                name: { type: 'string', description: 'Name of the submission', minimum: 1 },
                description: { type: 'string', description: 'Description of the submission', minimum: 1 },
                comment: {
                  type: 'string',
                  description: 'Comment from the submitter about the submission, only shown to administrators.',
                  minimum: 1
                },
                uid: {
                  type: 'string',
                  description: 'External universal identifier for the submission, provided by the submitting system',
                  nullable: true
                }
              }
            }
          },
          additionalProperties: false
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Multipart upload completed successfully'
    },
    ...defaultErrorResponses
  }
};

export function completeMultipartUploadHandler(): RequestHandler {
  return async (req, res) => {
    const token = req['keycloak_token'];

    const serviceClientSystemUser = getServiceClientSystemUser(token);

    const connection = serviceClientSystemUser
      ? getServiceAccountDBConnection(serviceClientSystemUser)
      : getDBConnection(token);

    try {
      await connection.open();

      const quarantineId = req.params.quarantineId;
      const { uploadId, ...rest } = req.body;

      const submissionUploadService = new SubmissionUploadService(connection);

      // Authorize the upload completion
      await submissionUploadService.authorizeUpload(quarantineId, uploadId);

      // Complete the upload
      await submissionUploadService.completeMultipartUpload({
        quarantineId,
        uploadId,
        systemUserId: req['system_user'].system_user_id,
        systemUserIdentifier: 'SIMS',
        ...rest
      });

      await connection.commit();

      res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'completeMultipartUploadHandler', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

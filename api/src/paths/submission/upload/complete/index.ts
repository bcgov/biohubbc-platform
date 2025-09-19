import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../services/submission-upload-service';
import { getServiceClientSystemUser } from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/upload/complete');

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
  completeMultipartUploadHandler()
];

POST.apiDoc = {
  description: 'Complete a multipart file upload for a submission',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          title: 'Complete Multipart Upload Request',
          type: 'object',
          required: ['uploadId', 'key', 'parts'],
          properties: {
            uploadId: {
              type: 'string',
              description: 'The multipart upload ID provided during initiation'
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
            }
          },
          additionalProperties: false
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Multipart upload completed successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['success', 'location', 'bucket', 'key', 'etag'],
            properties: {
              success: {
                type: 'boolean'
              },
              location: {
                type: 'string',
                description: 'Final location of the uploaded object'
              },
              bucket: {
                type: 'string'
              },
              key: {
                type: 'string'
              },
              etag: {
                type: 'string',
                description: 'ETag of the completed object'
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

export function completeMultipartUploadHandler(): RequestHandler {
  return async (req, res) => {
    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a sub or sub value is unknown'
      ]);
    }

    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

    try {
      await connection.open();

      const { uploadId, key, parts } = req.body;

      const submissionUploadService = new SubmissionUploadService(connection);

      const result = await submissionUploadService.completeMultipartUpload({
        uploadId,
        key,
        parts
      });

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'completeMultipartUploadHandler', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

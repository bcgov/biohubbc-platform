import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection, getServiceAccountDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../services/submission-upload-service';
import { getServiceClientSystemUser } from '../../../utils/keycloak-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/submission/upload');

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
  getSubmissionUploadUrl()
];

POST.apiDoc = {
  description: 'Get a presigned upload URL',
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
          title: 'BioHub Data Submission Upload Request',
          type: 'object',
          required: ['expectedSizeBytes'],
          properties: {
            expectedSizeBytes: {
              description: 'The size of the file to be uploaded in bytes (max 1 GB).',
              type: 'integer',
              minimum: 1,
              maximum: 1073741824, // 1 GB
              example: 524288000 // 500 MB example
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Multipart upload URLs and related metadata',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['submissionId', 'uploadId', 'key', 'partSizeBytes', 'partCount', 'presignedUrls'],
            properties: {
              submissionId: { type: 'string' },
              uploadId: { type: 'string' },
              key: { type: 'string' },
              partSizeBytes: { type: 'integer' },
              partCount: { type: 'integer' },
              presignedUrls: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['partNumber', 'url'],
                  properties: {
                    partNumber: { type: 'integer' },
                    url: { type: 'string', format: 'uri' }
                  }
                }
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getSubmissionUploadUrl(): RequestHandler {
  return async (req, res) => {
    const token = req['keycloak_token'];

    // TODO: Why do service accounts need to be distinct, if they are just user records like system admins?
    const serviceClientSystemUser = getServiceClientSystemUser(token);

    // Choose the appropriate DB connection based on auth type
    const connection = serviceClientSystemUser
      ? getServiceAccountDBConnection(serviceClientSystemUser)
      : getDBConnection(token);

    if (!connection) {
      throw new HTTP400('Failed to establish a database connection', [
        'Invalid or missing credentials for DB connection'
      ]);
    }

    try {
      await connection.open();

      const expectedSizeBytes = Number(req.body.expectedSizeBytes);

      const submissionUploadService = new SubmissionUploadService(connection);

      const result = await submissionUploadService.getTarUploadPresignedUrls(expectedSizeBytes);

      res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionUploadUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getServiceAccountDBConnection } from '../../../database/db';
import { HTTP400 } from '../../../errors/http-error';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { ArtifactService } from '../../../services/artifact-service';
import { getServiceClientSystemUser } from '../../../utils/keycloak-utils';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/submission/upload');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  getSubmissionUploadUrl()
];

GET.apiDoc = {
  description: 'Get a presigned upload URL',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [],
  responses: {
    200: {
      description: 'Submission OK',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['submissionId', 'uploadUrl'],
            properties: {
              submissionId: {
                type: 'string',
                description: 'The primary key of the submission that the upload is for'
              },
              uploadUrl: {
                description: 'Presigned upload URL',
                type: 'string'
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

export function getSubmissionUploadUrl(): RequestHandler {
  return async (req, res) => {
    // TODO Allow system admins
    const serviceClientSystemUser = getServiceClientSystemUser(req['keycloak_token']);

    if (!serviceClientSystemUser) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a sub or sub value is unknown'
      ]);
    }

    const connection = getServiceAccountDBConnection(serviceClientSystemUser);

    try {
      await connection.open();

      const artifactService = new ArtifactService(connection);

      const result = await artifactService.getSubmissionUploadUrl();

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

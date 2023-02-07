import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getS3SignedURL } from '../../../../utils/file-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/submission/create');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  getSubmissionSignedUrl()
];

GET.apiDoc = {
  description: 'Retrieve the signed URL of a submission.',
  tags: ['dwc'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'integer',
        minimum: 1
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'S3 signed URL.',
      content: {
        'application/json': {
          schema: {
            type: 'string'
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

//TODO: END POINT might be depercated, review uses and delete if not needed

export function getSubmissionSignedUrl(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);

      const submission = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

      const s3Key = submission.uuid;

      if (!s3Key) {
        throw new HTTP400('Failed to find submission S3 key.');
      }

      const signedS3Url = await getS3SignedURL(s3Key);

      if (!signedS3Url) {
        throw new HTTP400('Failed to retreive signed S3 URL from the given S3 key.');
      }

      await connection.commit();

      res.status(200).send(signedS3Url);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionSignedUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

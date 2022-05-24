import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { HTTP500 } from '../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../../services/submission-service';
import { getS3SignedURL } from '../../../../utils/file-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/dwc/dataset/create');

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
  responses: {
    200: {
      description: 'S3 signed URL.',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function getSubmissionSignedUrl(): RequestHandler {
  console.log('getSubmissionSignedUrl()')
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();
      
      const submissionService = new SubmissionService(connection);
      
      const s3Key: string | null = await submissionService.getSubmissionRecordS3Key(submissionId);
      console.log('s3Key:', s3Key)
      if (!s3Key) {
        throw new HTTP500('Failed to find submission S3 key.');
      }

      const signedS3Url: string | null = await getS3SignedURL(s3Key)
      console.log('SIGNEDURL:', signedS3Url)

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

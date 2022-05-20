import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { ISubmissionModel, ISubmissionModelWithStatus } from '../../../../repositories/submission-repository';
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
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const submissionId = Number(req.params.submissionId);

    try {
      await connection.open();
      
      const submissionService = new SubmissionService(connection);
      
      const submission: ISubmissionModel = await submissionService.getSubmissionRecordBySubmissionId(submissionId);
      const { input_key } = submission
      
      const x = await getS3SignedURL(input_key || '')

      await connection.commit();

      res.status(200).json(x);
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionSignedUrl', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

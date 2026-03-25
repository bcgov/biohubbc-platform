import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  CreateSubmissionUploadResponseSchema,
  SubmissionUploadRequestSchema
} from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionId}/upload');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'Contributor' }]
  })),
  createSubmissionUpload()
];

POST.apiDoc = {
  description: 'Initialize a new archive upload for an existing submission and get presigned URLs.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID.',
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: SubmissionUploadRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Multipart upload initialized successfully with presigned URLs.',
      content: {
        'application/json': {
          schema: CreateSubmissionUploadResponseSchema
        }
      }
    },
    ...defaultErrorResponses,
    404: {
      description: 'Submission not found (invalid submission UUID).'
    }
  }
};

/**
 * Appends a new upload to an existing submission.
 *
 * @returns {RequestHandler}
 */
export function createSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const submissionUuid = req.params.submissionId as string;
      const { bytes } = req.body;

      const uploadIngestionService = new UploadIngestionService(connection);
      const result = await uploadIngestionService.startArchiveUploadForExistingSubmissionByUuid(bytes, submissionUuid);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createSubmissionUpload', message: 'error initializing submission upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

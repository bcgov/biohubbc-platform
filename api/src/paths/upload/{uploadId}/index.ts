import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { CompleteMultipartUploadRequestSchema } from '../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../services/upload/upload-ingestion-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/upload/{uploadId}/archive/{uploadArchiveId}/index');

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ discriminator: 'ServiceClient' }]
  })),
  completeUpload()
];

PUT.apiDoc = {
  description: 'Complete a multipart file upload and create a submission.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'The upload ID returned from the /submission/upload endpoint',
      in: 'path',
      name: 'uploadId',
      schema: { type: 'string' },
      required: true
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CompleteMultipartUploadRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Multipart upload completed successfully'
    },
    ...defaultErrorResponses
  }
};

/**
 * Completes an upload
 *
 * @returns {RequestHandler}
 */
export function completeUpload(): RequestHandler {
  return async (req, res) => {
    const token = req.keycloak_token;
    const connection = getDBConnection(token);

    try {
      await connection.open();

      const { uploadId } = req.params;
      const uploadIngestionService = new UploadIngestionService(connection);

      await uploadIngestionService.completeArchiveUpload({
        uploadId,
        ...req.body
      });

      await connection.commit();

      res.status(201).json();
    } catch (error) {
      defaultLog.error({ label: 'completeUpload', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

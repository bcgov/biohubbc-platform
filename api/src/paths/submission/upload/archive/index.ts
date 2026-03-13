import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { v4 } from 'uuid';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  CreateSubmissionUploadRequestSchema,
  CreateSubmissionUploadResponseSchema
} from '../../../../openapi/schemas/upload';
import { ICreateSubmission } from '../../../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/upload/archive');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    or: [{ discriminator: 'Contributor' }]
  })),
  startUpload()
];

POST.apiDoc = {
  description: 'Initialize a new archive upload for a submission and get presigned URLs.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateSubmissionUploadRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Multipart upload initialized successfully with presigned URLs',
      content: {
        'application/json': {
          schema: CreateSubmissionUploadResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Returns presigned upload URL resources for a new submission archive
 *
 * @returns {RequestHandler}
 */
export function startUpload(): RequestHandler {
  return async (req, res) => {
    const token = req.keycloak_token!;

    const connection = getDBConnection(token);

    try {
      await connection.open();

      const system_user_id = req.system_user!.system_user_id;
      const contributorId = req.contributor_id!;

      const { bytes, ...rest } = req.body;
      const submission = { ...rest, uuid: v4(), system_user_id, contributor_id: contributorId } as ICreateSubmission;
      const uploadIngestionService = new UploadIngestionService(connection);

      const result = await uploadIngestionService.startArchiveUpload(bytes, submission);

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'startUpload', message: 'error initializing archive upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

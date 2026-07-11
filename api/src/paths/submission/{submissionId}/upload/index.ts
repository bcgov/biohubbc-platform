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
import { UserService } from '../../../../services/user-service';
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
    ...defaultErrorResponses
  }
};

/**
 * Appends a new upload to an existing submission.
 *
 * @returns {RequestHandler}
 */
export function createSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const token = req.keycloak_token!;

    const connection = getDBConnection(token);

    try {
      await connection.open();

      // The request is authenticated as the submitting service client (Contributor). The human
      // submitter on whose behalf the upload is appended is supplied in the request body. Resolve
      // them, creating or reactivating their system_user record as needed; any failure throws and
      // rolls back the transaction so no records are created.
      const { guid, identifier, identitySource } = req.body.submitter;

      const userService = new UserService(connection);
      const submitter = await userService.ensureSystemUser(guid, identifier, identitySource);

      const submissionUuid = req.params.submissionId as string;
      const { bytes, blueprint_id } = req.body;

      const uploadIngestionService = new UploadIngestionService(connection);
      const result = await uploadIngestionService.startArchiveUploadForExistingSubmissionByUuid(
        bytes,
        submissionUuid,
        submitter.system_user_id,
        blueprint_id
      );

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

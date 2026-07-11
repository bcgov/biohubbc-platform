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
import { UserService } from '../../../../services/user-service';
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

      // The request is authenticated as the submitting service client (Contributor). The human
      // submitter on whose behalf the submission is created is supplied in the request body.
      // Resolve them, creating or reactivating their system_user record as needed; any failure
      // throws and rolls back the transaction so no records are created.
      const { guid, identifier, identitySource } = req.body.submitter;

      const userService = new UserService(connection);
      const submitter = await userService.ensureSystemUser(guid, identifier, identitySource);

      const system_user_id = submitter.system_user_id;
      const contributorId = req.contributor_id!;

      const { bytes, blueprint_id, name, description, comment } = req.body;
      const submission: ICreateSubmission = {
        uuid: v4(),
        system_user_id,
        contributor_id: contributorId,
        name,
        description,
        comment
      };
      const uploadIngestionService = new UploadIngestionService(connection);

      const result = await uploadIngestionService.startArchiveUpload(bytes, submission, system_user_id, blueprint_id);

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

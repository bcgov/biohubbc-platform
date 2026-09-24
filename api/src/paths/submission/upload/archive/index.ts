import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  CreateSubmissionUploadRequestSchema,
  CreateSubmissionUploadResponseSchema
} from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/upload/archive');

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        discriminator: 'Contributor',
        clientId: req.body.client_id ?? req.keycloak_token?.clientId ?? req.keycloak_token?.azp ?? null
      }
    ]
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

      const uploadIngestionService = new UploadIngestionService(connection);
      const result = await uploadIngestionService.createSubmissionArchiveUpload({
        contributorId: req.contributor_id!,
        bytes: req.body.bytes,
        name: req.body.name,
        description: req.body.description,
        comment: req.body.comment,
        submitters: req.body.submitters,
        blueprintId: req.body.blueprint_id
      });

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

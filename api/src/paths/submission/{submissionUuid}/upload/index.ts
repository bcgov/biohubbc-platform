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

const defaultLog = getLogger('paths/submission/{submissionUuid}/upload');

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionUuid: req.params.submissionUuid
      },
      {
        discriminator: 'Contributor',
        clientId: req.body.client_id ?? req.keycloak_token?.clientId ?? req.keycloak_token?.azp ?? null
      }
    ]
  })),
  createSubmissionUpload()
];

POST.apiDoc = {
  description:
    'Initialize a new archive upload for an existing submission. The authenticated user must belong to the selected contributor and have submission-team access (or system administrator access). The caller is granted access to the new upload. Optional submitters are added to the submission and upload teams.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID.',
      in: 'path',
      name: 'submissionUuid',
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

      const uploadIngestionService = new UploadIngestionService(connection);
      const result = await uploadIngestionService.startArchiveUploadForExistingSubmissionByUuid({
        bytes: req.body.bytes,
        submissionUuid: req.params.submissionUuid,
        submitters: req.body.submitters,
        blueprintId: req.body.blueprint_id
      });

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

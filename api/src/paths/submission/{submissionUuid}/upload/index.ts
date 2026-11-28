import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../../../database/db';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from '../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../openapi/schemas/pagination';
import {
  CreateSubmissionUploadResponseSchema,
  SubmissionUploadRequestSchema
} from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../services/upload/submission-upload-service';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/submission/{submissionUuid}/upload');

export const GET: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionUuid: req.params.submissionUuid
      }
    ]
  })),
  listSubmissionUploads()
];

GET.apiDoc = {
  description:
    "List a submission's active uploads, newest first by default, with each upload's identifier, status, decision and creation date. The authenticated user must belong to the submission's team (or have system administrator access).",
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
    },
    ...paginationRequestQueryParamSchema.filter((parameter) => parameter.name !== 'sort'),
    {
      in: 'query',
      name: 'sort',
      schema: { type: 'string', enum: ['create_date', 'status', 'decision'], default: 'create_date' }
    }
  ],
  responses: {
    200: {
      description: 'A page of submission uploads.',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['uploads', 'pagination'],
            additionalProperties: false,
            properties: {
              uploads: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['submission_upload_id', 'status', 'decision', 'create_date'],
                  additionalProperties: false,
                  properties: {
                    submission_upload_id: { type: 'string', format: 'uuid' },
                    status: { type: 'string', enum: SubmissionUploadJobStatus.options },
                    decision: { type: 'string', enum: SubmissionUploadDecision.options },
                    create_date: { type: 'string' }
                  }
                }
              },
              pagination: paginationResponseSchema
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Lists a submission's active uploads for members of the submission's team.
 *
 * @returns {RequestHandler}
 */
export function listSubmissionUploads(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token!);

    try {
      await connection.open();

      const submissionUploadService = new SubmissionUploadService(connection);
      const result = await submissionUploadService.listSubmissionUploadsBySubmissionUuid(
        req.params.submissionUuid,
        makePaginationOptionsFromRequest(req)
      );

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'listSubmissionUploads', message: 'error listing submission uploads', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    and: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionUuid: req.params.submissionUuid
      }
    ]
  })),
  createSubmissionUpload()
];

POST.apiDoc = {
  description:
    "Initialize a new archive upload for an existing submission. The authenticated user must belong to the submission's contributor and have submission-team access (or system administrator access). The caller is granted access to the new upload. Optional submitters are added to the submission and upload teams.",
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
        archiveFormat: req.body.archiveFormat,
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

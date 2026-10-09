import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { getDBConnection } from '../../../../../database/db';
import { SubmissionUploadDecision, SubmissionUploadJobStatus } from '../../../../../models/submission-upload';
import { defaultErrorResponses } from '../../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema, paginationResponseSchema } from '../../../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/submission/{submissionId}/upload');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        discriminator: 'SystemRole',
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR]
      }
    ]
  })),
  listAdminSubmissionUploads()
];

GET.apiDoc = {
  description: 'List active uploads for a submission, newest first by default.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'submissionId',
      required: true,
      schema: { type: 'integer', minimum: 1 }
    },
    ...paginationRequestQueryParamSchema.filter((parameter) => parameter.name !== 'sort'),
    {
      in: 'query',
      name: 'sort',
      schema: { type: 'string', enum: ['create_date', 'create_user', 'status', 'decision'], default: 'create_date' }
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
                  additionalProperties: false,
                  required: [
                    'submission_upload_id',
                    'upload_id',
                    'status',
                    'decision',
                    'ticket_id',
                    'comment',
                    'create_date',
                    'create_user',
                    'submitted_by_identifier'
                  ],
                  properties: {
                    submission_upload_id: { type: 'string', format: 'uuid' },
                    upload_id: { type: 'string', format: 'uuid' },
                    status: { type: 'string', enum: SubmissionUploadJobStatus.options },
                    decision: { type: 'string', enum: SubmissionUploadDecision.options },
                    ticket_id: { type: 'string', format: 'uuid' },
                    comment: { type: 'string', nullable: true },
                    create_date: { type: 'string' },
                    create_user: { type: 'integer' },
                    submitted_by_identifier: { type: 'string', nullable: true }
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
 * List a submission's uploads for system and data administrators.
 *
 * @returns {RequestHandler} Handler with the standard transaction and connection lifecycle.
 */
export function listAdminSubmissionUploads(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();
      const submissionId = Number(req.params.submissionId);
      const pagination = makePaginationOptionsFromRequest(req);
      const service = new SubmissionUploadService(connection);
      const result = await service.listAdminSubmissionUploads(submissionId, pagination);
      await connection.commit();
      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'listAdminSubmissionUploads', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

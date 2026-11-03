import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../../openapi/schemas/pagination';
import { AdminSubmissionUploadPaginatedListResponseSchema } from '../../../../openapi/schemas/submission-upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SubmissionUploadService } from '../../../../services/upload/submission-upload-service';
import { getLogger } from '../../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/submission/upload');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getAdminSubmissionUploadList()
];

GET.apiDoc = {
  description: 'Get the active uploads of every active submission, newest first by default.',
  tags: ['admin'],
  security: [{ Bearer: [] }],
  parameters: [
    ...paginationRequestQueryParamSchema.filter((parameter) => parameter.name !== 'sort'),
    {
      in: 'query',
      name: 'sort',
      required: false,
      schema: {
        type: 'string',
        enum: ['submission_name', 'create_date', 'status', 'decision'],
        default: 'create_date'
      }
    },
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter uploads by the name of their submission'
    }
  ],
  responses: {
    200: {
      description: 'A page of submission uploads.',
      content: {
        'application/json': {
          schema: AdminSubmissionUploadPaginatedListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get one page of the uploads of every submission for system and data administrators.
 *
 * @returns {RequestHandler} Handler with the standard transaction and connection lifecycle.
 */
export function getAdminSubmissionUploadList(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const keyword = req.query.search as string | undefined;
    const filters = { keyword };
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const submissionUploadService = new SubmissionUploadService(connection);
      const result = await submissionUploadService.getAdminSubmissionUploadList(filters, pagination);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getAdminSubmissionUploadList', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { AdminSubmissionPaginatedListResponseSchema } from '../../../openapi/schemas/submission';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SubmissionService } from '../../../services/submission-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/submission');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getAdminSubmissionList()
];

GET.apiDoc = {
  description: 'Get every active submission in the system, with the name of its contributor.',
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
        enum: ['name', 'contributor_name', 'submitted_timestamp', 'publish_timestamp'],
        default: 'submitted_timestamp'
      }
    },
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter submissions by name'
    }
  ],
  responses: {
    200: {
      description: 'A page of submissions.',
      content: {
        'application/json': {
          schema: AdminSubmissionPaginatedListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get one page of every active submission in the system for system and data administrators.
 *
 * @returns {RequestHandler} Handler with the standard transaction and connection lifecycle.
 */
export function getAdminSubmissionList(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const keyword = req.query.search as string | undefined;
    const filters = { keyword };
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const submissionService = new SubmissionService(connection);
      const result = await submissionService.getAdminSubmissionList(filters, pagination);

      await connection.commit();

      return res.status(200).json(result);
    } catch (error) {
      defaultLog.error({ label: 'getAdminSubmissionList', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

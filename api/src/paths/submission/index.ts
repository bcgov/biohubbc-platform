import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { SubmissionFilters } from '../../models/submission';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../openapi/schemas/pagination';
import { SubmissionListResponseSchema } from '../../openapi/schemas/submission';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { SubmissionService } from '../../services/submission-service';
import { getLogger } from '../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../utils/pagination';

const defaultLog = getLogger('paths/submission/index');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [{ discriminator: 'SystemUser' }]
    };
  }),
  getSubmissions()
];

GET.apiDoc = {
  description: 'Get all submissions that the current user has access to via their submission team membership.',
  tags: ['submission'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: {
        type: 'string'
      },
      description: 'Optional case-insensitive search across submission name.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'List of submissions accessible to the current user.',
      content: {
        'application/json': {
          schema: SubmissionListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get all submissions accessible to the current user via their submission team membership.
 *
 * @returns {RequestHandler}
 */
export function getSubmissions(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const service = new SubmissionService(connection);
      const systemUserId = connection.systemUserId();
      const filters = { search: req.query.search } as SubmissionFilters;

      const [submissions, count] = await Promise.all([
        service.getSubmissionsByUserId(systemUserId, pagination, filters),
        service.getSubmissionsByUserIdCount(systemUserId, filters)
      ]);

      await connection.commit();

      return res.status(200).json({
        submissions,
        pagination: makePaginationResponse(count, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getSubmissionsForUser', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

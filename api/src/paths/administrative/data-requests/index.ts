import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { DataRequestPaginatedListResponseSchema } from '../../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../services/data-request-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/data-requests');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [
      {
        validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN, SYSTEM_ROLE.DATA_ADMINISTRATOR],
        discriminator: 'SystemRole'
      }
    ]
  })),
  getDataRequests()
];

GET.apiDoc = {
  description: 'Get every data request in the system, with its decision and the user who submitted it.',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    ...paginationRequestQueryParamSchema,
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search term to filter data requests by reason'
    }
  ],
  responses: {
    200: {
      description: 'Paginated list of data requests.',
      content: {
        'application/json': {
          schema: DataRequestPaginatedListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Get every data request in the system with pagination.
 *
 * @returns {RequestHandler}
 */
export function getDataRequests(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    const keyword = req.query.search as string | undefined;
    const filters = { keyword };
    const pagination = makePaginationOptionsFromRequest(req);

    try {
      await connection.open();

      const dataRequestService = new DataRequestService(connection);
      const dataRequestList = await dataRequestService.getDataRequestList(filters, pagination);

      await connection.commit();

      return res.status(200).json({
        data_requests: dataRequestList.data_requests,
        pagination: makePaginationResponse(dataRequestList.total, pagination)
      });
    } catch (error) {
      defaultLog.error({ label: 'getDataRequests', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

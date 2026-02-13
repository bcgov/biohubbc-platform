import { Request, RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getAPIUserDBConnection, getDBConnection } from '../../database/db';
import {
  CreateDataRequestRequestSchema,
  DataRequestListResponseSchema,
  DataRequestWithStatusResponseSchema
} from '../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DataRequestService } from '../../services/data-request-service';
import { getLogger } from '../../utils/logger';
import { DataRequestFilters } from '../../models/data-request';

const defaultLog = getLogger('paths/data-request');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  findDataRequests()
];
export const POST: Operation = [createDataRequest()];

GET.apiDoc = {
  description: 'Find all data request records, optionally filtered by date range, requested_by, or team_id',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'query',
      name: 'date_from',
      required: false,
      schema: { type: 'string', description: 'Filter by create_date >= date_from (ISO date string)' }
    },
    {
      in: 'query',
      name: 'date_to',
      required: false,
      schema: { type: 'string', description: 'Filter by create_date <= date_to (ISO date string)' }
    },
    {
      in: 'query',
      name: 'requested_by',
      required: false,
      schema: { type: 'integer', description: 'Filter by system user ID who requested' }
    },
    {
      in: 'query',
      name: 'team_id',
      required: false,
      schema: { type: 'string', format: 'uuid', description: 'Filter by team ID' }
    }
  ],
  responses: {
    200: {
      description: 'Data requests retrieved successfully',
      content: {
        'application/json': {
          schema: DataRequestListResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

POST.apiDoc = {
  description: 'Create a new data request',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateDataRequestRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Data request created successfully',
      content: {
        'application/json': {
          schema: DataRequestWithStatusResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Find all data request records, optionally filtered by query params.
 *
 * @returns {RequestHandler}
 */
export function findDataRequests(): RequestHandler {
  return async (req, res) => {
    const isAuthenticated = !!req.keycloak_token;
    const connection = isAuthenticated ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();

    try {
      await connection.open();

      const filters = parseQueryParams(req);

      const dataRequestService = new DataRequestService(connection);
      const dataRequests = await dataRequestService.findDataRequests(filters);

      await connection.commit();

      res.status(200).json(dataRequests);
    } catch (error) {
      defaultLog.error({ label: 'findDataRequests', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Creates a new data request.
 *
 * @returns {RequestHandler}
 */
export function createDataRequest(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const systemUserId = connection.systemUserId();
      const { team_id: teamId, reason } = req.body;

      const dataRequestService = new DataRequestService(connection);

      const dataRequest = await dataRequestService.createDataRequest(systemUserId, { reason }, teamId);

      await connection.commit();

      res.status(201).json(dataRequest);
    } catch (error) {
      defaultLog.error({ label: 'createDataRequest', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Parses query params from the request into a filters object for data request list.
 * Returns empty object when no filter params are present.
 */
function parseQueryParams(req: Request<unknown, unknown, unknown, DataRequestFilters>): DataRequestFilters {
  const { date_from, date_to, requested_by, team_id } = req.query;
  const filters = {
    ...(date_from && { date_from: String(date_from) }),
    ...(date_to && { date_to: String(date_to) }),
    ...(requested_by !== undefined && { requested_by: Number(requested_by) }),
    ...(team_id && { team_id: String(team_id) })
  };
  return filters;
}

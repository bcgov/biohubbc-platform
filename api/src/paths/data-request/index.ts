import { Request, RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { DataRequestFilters } from '../../models/data-request';
import {
  CreateDataRequestRequestSchema,
  DataRequestListResponseSchema,
  DataRequestWithStatusResponseSchema
} from '../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { DataRequestService } from '../../services/data-request-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/data-request');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  findDataRequests()
];
export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  createDataRequest()
];

GET.apiDoc = {
  description: 'Find all data request records, optionally filtered by date range, requested_by, team_id, or status',
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
      schema: { type: 'string', format: 'uuid', description: 'Filter by a single team ID' }
    },
    {
      in: 'query',
      name: 'status',
      required: false,
      schema: {
        type: 'string',
        enum: ['REQUESTED', 'APPROVED', 'DENIED'],
        description: 'Filter by request status'
      }
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
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const filters = parseQueryParams(req);
      const systemUserId = connection.systemUserId();

      const dataRequestService = new DataRequestService(connection);
      const dataRequests = await dataRequestService.findDataRequestsBySystemUserId(systemUserId, filters);

      await connection.commit();

      return res.status(200).json(dataRequests);
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

      const dataRequest = await dataRequestService.createDataRequest(systemUserId, { reason, team_id: teamId });

      await connection.commit();

      return res.status(201).json(dataRequest);
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
 * Query params are strings or undefined per the OpenAPI spec.
 */
function parseQueryParams(req: Request<unknown, unknown, unknown, DataRequestFilters>): DataRequestFilters {
  const q = req.query;
  const filters: DataRequestFilters = {
    date_from: q.date_from ?? undefined,
    date_to: q.date_to ?? undefined,
    requested_by: q.requested_by ? Number(q.requested_by) : undefined,
    team_id: q.team_id ?? undefined,
    status: q.status ?? undefined
  };
  return filters;
}

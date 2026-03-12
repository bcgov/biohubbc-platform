import { Request, RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getDBConnection } from '../../database/db';
import { DataRequestFilters } from '../../models/data-request';
import { DataRequestListResponseSchema } from '../../openapi/schemas/data-request';
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

GET.apiDoc = {
  description:
    'Find data request records for teams the current user belongs to, optionally filtered by date range, requested_by, team_id, or status',
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
        enum: ['requested', 'reviewed', 'approved', 'denied'],
        description: 'Filter by derived policy workflow status'
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

/**
 * Find data request records for teams the current user belongs to, optionally filtered by query params.
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

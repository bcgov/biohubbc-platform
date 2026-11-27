import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { SummaryMetricFilters } from '../../../models/summary-metric';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import {
  CreateSummaryMetricRequestSchema,
  SummaryMetricListResponseSchema,
  SummaryMetricSchema
} from '../../../openapi/schemas/summary-metric';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SummaryMetricService } from '../../../services/summary-metric-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/summary-metrics');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSummaryMetrics()
];
GET.apiDoc = {
  description: 'List active metric definitions.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'search',
      required: false,
      schema: { type: 'string' },
      description: 'Search metric keys and names.'
    },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Records retrieved',
      content: { 'application/json': { schema: SummaryMetricListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};
export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createSummaryMetric()
];
POST.apiDoc = {
  description: 'Create metric definitions.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  requestBody: { required: true, content: { 'application/json': { schema: CreateSummaryMetricRequestSchema } } },
  responses: {
    201: { description: 'Record created', content: { 'application/json': { schema: SummaryMetricSchema } } },
    ...defaultErrorResponses
  }
};

/** Read metric definitions. */
export function getSummaryMetrics(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricService(connection);
      const filters: SummaryMetricFilters = { search: req.query.search as string | undefined };
      const pagination = makePaginationOptionsFromRequest(req);
      const [records, count] = await Promise.all([
        service.getSummaryMetrics(filters, pagination),
        service.getSummaryMetricsCount(filters)
      ]);
      await connection.commit();
      return res.status(200).json({ summary_metrics: records, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getSummaryMetrics', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/** Create metric definitions. */
export function createSummaryMetric(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricService(connection);
      const record = await service.createSummaryMetric(req.body);
      await connection.commit();
      return res.status(201).json(record);
    } catch (error) {
      defaultLog.error({ label: 'createSummaryMetric', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

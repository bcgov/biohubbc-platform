import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { SummaryMetricDataFilters } from '../../../models/summary-metric-data';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { paginationRequestQueryParamSchema } from '../../../openapi/schemas/pagination';
import {
  CreateSummaryMetricDataRequestSchema,
  SummaryMetricDataListResponseSchema,
  SummaryMetricDataSchema
} from '../../../openapi/schemas/summary-metric';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { SummaryMetricDataService } from '../../../services/summary-metric-data-service';
import { getLogger } from '../../../utils/logger';
import { makePaginationOptionsFromRequest, makePaginationResponse } from '../../../utils/pagination';

const defaultLog = getLogger('paths/administrative/summary-metrics-data');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSummaryMetricsData()
];
GET.apiDoc = {
  description: 'List active calculated metric values.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'query',
      name: 'summary_metric_id',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 2147483647 }
    },
    { in: 'query', name: 'run_id', required: false, schema: { type: 'string', format: 'uuid' } },
    ...paginationRequestQueryParamSchema
  ],
  responses: {
    200: {
      description: 'Records retrieved',
      content: { 'application/json': { schema: SummaryMetricDataListResponseSchema } }
    },
    ...defaultErrorResponses
  }
};
export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  createSummaryMetricData()
];
POST.apiDoc = {
  description: 'Create calculated metric values.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  requestBody: { required: true, content: { 'application/json': { schema: CreateSummaryMetricDataRequestSchema } } },
  responses: {
    201: { description: 'Record created', content: { 'application/json': { schema: SummaryMetricDataSchema } } },
    ...defaultErrorResponses
  }
};

/** Read calculated metric values. */
export function getSummaryMetricsData(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricDataService(connection);
      const filters: SummaryMetricDataFilters = {
        summary_metric_id: req.query.summary_metric_id === undefined ? undefined : Number(req.query.summary_metric_id),
        run_id: req.query.run_id as string | undefined
      };
      const pagination = makePaginationOptionsFromRequest(req);
      const [records, count] = await Promise.all([
        service.getSummaryMetricsData(filters, pagination),
        service.getSummaryMetricsDataCount(filters)
      ]);
      await connection.commit();
      return res
        .status(200)
        .json({ summary_metrics_data: records, pagination: makePaginationResponse(count, pagination) });
    } catch (error) {
      defaultLog.error({ label: 'getSummaryMetricsData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

/** Create calculated metric values. */
export function createSummaryMetricData(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricDataService(connection);
      const record = await service.createSummaryMetricData(req.body);
      await connection.commit();
      return res.status(201).json(record);
    } catch (error) {
      defaultLog.error({ label: 'createSummaryMetricData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

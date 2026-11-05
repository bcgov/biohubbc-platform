import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  SummaryMetricDataSchema,
  UpdateSummaryMetricDataRequestSchema
} from '../../../../openapi/schemas/summary-metric';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SummaryMetricDataService } from '../../../../services/summary-metric-data-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/summary-metrics-data/{summaryMetricsDataId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSummaryMetricData()
];
GET.apiDoc = {
  description: 'Get an active record.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'summaryMetricsDataId',
      required: true,
      schema: { type: 'string', pattern: '^[1-9][0-9]*$', maxLength: 19 }
    }
  ],

  responses: {
    200: { description: 'Record retrieved', content: { 'application/json': { schema: SummaryMetricDataSchema } } },
    ...defaultErrorResponses
  }
};

/** Read calculated metric values. */
export function getSummaryMetricData(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricDataService(connection);
      const record = await service.getSummaryMetricData(req.params.summaryMetricsDataId);
      await connection.commit();
      return res.status(200).json(record);
    } catch (error) {
      defaultLog.error({ label: 'getSummaryMetricData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const PUT: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  updateSummaryMetricData()
];
PUT.apiDoc = {
  description: 'Correct a calculated value without changing its metric or run.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'summaryMetricsDataId',
      required: true,
      schema: { type: 'string', pattern: '^[1-9][0-9]*$', maxLength: 19 }
    }
  ],
  requestBody: { required: true, content: { 'application/json': { schema: UpdateSummaryMetricDataRequestSchema } } },
  responses: {
    200: { description: 'Record retrieved', content: { 'application/json': { schema: SummaryMetricDataSchema } } },
    ...defaultErrorResponses
  }
};

/** Update calculated metric values. */
export function updateSummaryMetricData(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricDataService(connection);
      const record = await service.updateSummaryMetricData(req.params.summaryMetricsDataId, req.body);
      await connection.commit();
      return res.status(200).json(record);
    } catch (error) {
      defaultLog.error({ label: 'updateSummaryMetricData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  deleteSummaryMetricData()
];
DELETE.apiDoc = {
  description: 'Soft-delete a record by setting record_end_date; preserve history and foreign keys.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'summaryMetricsDataId',
      required: true,
      schema: { type: 'string', pattern: '^[1-9][0-9]*$', maxLength: 19 }
    }
  ],

  responses: { 204: { description: 'Record retired' }, ...defaultErrorResponses }
};

/** Soft-delete calculated metric values. */
export function deleteSummaryMetricData(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricDataService(connection);
      await service.deleteSummaryMetricData(req.params.summaryMetricsDataId);
      await connection.commit();
      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteSummaryMetricData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

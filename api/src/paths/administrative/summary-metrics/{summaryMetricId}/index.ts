import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { SummaryMetricSchema, UpdateSummaryMetricRequestSchema } from '../../../../openapi/schemas/summary-metric';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { SummaryMetricService } from '../../../../services/summary-metric-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/administrative/summary-metrics/{summaryMetricId}');

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getSummaryMetric()
];
GET.apiDoc = {
  description: 'Get an active record.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'summaryMetricId',
      required: true,
      schema: { type: 'integer', minimum: 1, maximum: 2147483647 }
    }
  ],

  responses: {
    200: { description: 'Record retrieved', content: { 'application/json': { schema: SummaryMetricSchema } } },
    ...defaultErrorResponses
  }
};

/** Read metric definitions. */
export function getSummaryMetric(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricService(connection);
      const record = await service.getSummaryMetric(Number(req.params.summaryMetricId));
      await connection.commit();
      return res.status(200).json(record);
    } catch (error) {
      defaultLog.error({ label: 'getSummaryMetric', message: 'error', error });
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
  updateSummaryMetric()
];
PUT.apiDoc = {
  description: 'Update metric name and description; calculation keys are immutable.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'summaryMetricId',
      required: true,
      schema: { type: 'integer', minimum: 1, maximum: 2147483647 }
    }
  ],
  requestBody: { required: true, content: { 'application/json': { schema: UpdateSummaryMetricRequestSchema } } },
  responses: {
    200: { description: 'Record retrieved', content: { 'application/json': { schema: SummaryMetricSchema } } },
    ...defaultErrorResponses
  }
};

/** Update metric definitions. */
export function updateSummaryMetric(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricService(connection);
      const record = await service.updateSummaryMetric(Number(req.params.summaryMetricId), req.body);
      await connection.commit();
      return res.status(200).json(record);
    } catch (error) {
      defaultLog.error({ label: 'updateSummaryMetric', message: 'error', error });
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
  deleteSummaryMetric()
];
DELETE.apiDoc = {
  description: 'Soft-delete a record by setting record_end_date; preserve history and foreign keys.',
  tags: ['summary-metrics'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'summaryMetricId',
      required: true,
      schema: { type: 'integer', minimum: 1, maximum: 2147483647 }
    }
  ],

  responses: { 204: { description: 'Record retired' }, ...defaultErrorResponses }
};

/** Soft-delete metric definitions. */
export function deleteSummaryMetric(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);
    try {
      await connection.open();
      const service = new SummaryMetricService(connection);
      await service.deleteSummaryMetric(Number(req.params.summaryMetricId));
      await connection.commit();
      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'deleteSummaryMetric', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

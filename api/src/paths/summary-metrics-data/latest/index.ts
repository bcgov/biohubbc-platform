import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { LatestSummaryMetricDataResponseSchema } from '../../../openapi/schemas/summary-metric';
import { SummaryMetricDataService } from '../../../services/summary-metric-data-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/summary-metrics-data/latest');

export const GET: Operation = [getLatestSummaryMetricsData()];
GET.apiDoc = {
  description:
    'Get the latest active value for each active summary metric for the landing page. Metrics without values are omitted.',
  tags: ['summary-metrics'],
  security: [{ OptionalBearer: [] }],
  responses: {
    200: {
      description: 'Latest metric values, or an empty array before any calculation.',
      content: { 'application/json': { schema: LatestSummaryMetricDataResponseSchema } }
    },
    ...defaultErrorResponses
  }
};

/** Public aggregate data, using the existing anonymous/authenticated connection convention. */
export function getLatestSummaryMetricsData(): RequestHandler {
  return async (req, res) => {
    const connection = req.keycloak_token ? getDBConnection(req.keycloak_token) : getAPIUserDBConnection();
    try {
      await connection.open();
      const service = new SummaryMetricDataService(connection);
      const summary_metrics_data = await service.getLatestSummaryMetricsData();
      await connection.commit();
      return res.status(200).json({ summary_metrics_data });
    } catch (error) {
      defaultLog.error({ label: 'getLatestSummaryMetricsData', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      await connection.release();
    }
  };
}

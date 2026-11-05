import { getDBPool, getDefaultPoolConfig, initDBPool } from './database/db';
import { withConnection } from './queue/with-connection';
import { SubmissionMetricsService } from './services/submission-metrics-service';
import { getLogger } from './utils/logger';

const defaultLog = getLogger('compute-submission-metrics');

/** One-off worker entry point for calculating and committing a summary snapshot. */
async function computeSubmissionMetrics(): Promise<void> {
  initDBPool(getDefaultPoolConfig());

  try {
    const metrics = await withConnection(async (connection) => {
      const service = new SubmissionMetricsService(connection);
      const runId = await service.calculateMetrics();
      return service.getMetricsByRunId(runId);
    });

    defaultLog.info({ label: 'computeSubmissionMetrics', message: 'Saved submission metrics snapshot', metrics });
  } finally {
    await getDBPool()?.end();
  }
}

try {
  await computeSubmissionMetrics();
} catch (error) {
  defaultLog.error({ label: 'computeSubmissionMetrics', message: 'Submission metrics calculation failed', error });
  process.exitCode = 1;
}

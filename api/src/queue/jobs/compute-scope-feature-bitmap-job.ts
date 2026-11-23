import PgBoss from 'pg-boss';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/compute-scope-feature-bitmap-job');

/**
 * Compute scope feature bitmap job data interface.
 * Contains the security scope ID whose feature bitmap needs to be rebuilt.
 */
export interface IComputeScopeFeatureBitmapJobData {
  /** The security scope ID to rebuild the feature bitmap for */
  securityScopeId: string;
}

/**
 * Compute scope feature bitmap job handler.
 *
 * Rebuilds `security_scope.feature_ids` — the set of features a security scope
 * grants: its anchors and their available descendants. The bitmap is built once
 * per scope, not per team.
 *
 * The URN resolve and the build run in one transaction per job, so the scope's
 * active approved ALLOW statement is checked in the same snapshot that writes the
 * bitmap. The build is a single statement that replaces the stored value, which
 * makes it idempotent — safe to retry.
 *
 * If the scope currently has no active approved ALLOW statement, the job exits
 * and leaves `feature_ids` as it is. Access is controlled by `team_security_scope`,
 * so a left-over bitmap grants nothing.
 *
 * @param {PgBoss.Job<IComputeScopeFeatureBitmapJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const computeScopeFeatureBitmapJobHandler: PgBoss.WorkHandler<IComputeScopeFeatureBitmapJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { securityScopeId } = job.data;

    defaultLog.info({
      label: 'computeScopeFeatureBitmapJobHandler',
      message: 'Processing compute scope feature bitmap job',
      jobId: job.id,
      securityScopeId
    });

    try {
      const isBuilt = await withConnection(async (conn) => {
        const securityScopeService = new SecurityScopeService(conn);
        const urn = await securityScopeService.resolveUrnForScope(securityScopeId);

        if (!urn) {
          return false;
        }

        await securityScopeService.buildScopeFeatureBitmap(securityScopeId, urn);

        return true;
      });

      if (!isBuilt) {
        defaultLog.info({
          label: 'computeScopeFeatureBitmapJobHandler',
          message: 'Scope has no active approved ALLOW statements, feature bitmap build skipped',
          jobId: job.id,
          securityScopeId
        });
        continue;
      }

      defaultLog.info({
        label: 'computeScopeFeatureBitmapJobHandler',
        message: 'Compute scope feature bitmap job completed successfully',
        jobId: job.id,
        securityScopeId
      });
    } catch (error) {
      defaultLog.error({
        label: 'computeScopeFeatureBitmapJobHandler',
        message: 'Compute scope feature bitmap job failed',
        jobId: job.id,
        securityScopeId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    }
  }
};

/**
 * Dead Letter Queue handler for failed compute scope feature bitmap jobs.
 *
 * A failed build is non-critical — the scope keeps the bitmap it had, which may
 * be out of date or NULL. There is no tracking record to update, so this handler
 * only logs the failure with error details.
 *
 * @param {PgBoss.Job<IComputeScopeFeatureBitmapJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const computeScopeFeatureBitmapFailedHandler: PgBoss.WorkHandler<IComputeScopeFeatureBitmapJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { securityScopeId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IComputeScopeFeatureBitmapJobData>).output;

    defaultLog.warn({
      label: 'computeScopeFeatureBitmapFailedHandler',
      message: 'Compute scope feature bitmap job failed after all retries',
      jobId: job.id,
      securityScopeId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};

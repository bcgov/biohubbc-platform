import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/compute-scope-anchors-job');

/**
 * Compute scope anchors job data interface.
 * Contains the security scope ID whose anchors need to be computed.
 */
export interface IComputeScopeAnchorsJobData {
  /** The security scope ID to compute anchors for */
  securityScopeId: string;
}

/**
 * Compute scope anchors job handler.
 *
 * Computes anchor features for a security scope — the root-level nodes of
 * secured subtrees that match the scope's URN pattern. Anchors are computed
 * once per scope, not per team — if 10 teams share the same policy, anchors
 * are computed once for the shared scope.
 *
 * @param {PgBoss.Job<IComputeScopeAnchorsJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const computeScopeAnchorsJobHandler: PgBoss.WorkHandler<IComputeScopeAnchorsJobData> = async (jobs) => {
  for (const job of jobs) {
    const { securityScopeId } = job.data;

    defaultLog.info({
      label: 'computeScopeAnchorsJobHandler',
      message: 'Processing compute scope anchors job',
      jobId: job.id,
      securityScopeId
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const securityScopeService = new SecurityScopeService(connection);
      await securityScopeService.computeAnchorsForScope(securityScopeId);

      await connection.commit();

      defaultLog.info({
        label: 'computeScopeAnchorsJobHandler',
        message: 'Compute scope anchors job completed successfully',
        jobId: job.id,
        securityScopeId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'computeScopeAnchorsJobHandler',
        message: 'Compute scope anchors job failed',
        jobId: job.id,
        securityScopeId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    } finally {
      connection.release();
    }
  }
};

/**
 * Dead Letter Queue handler for failed compute scope anchors jobs.
 *
 * Anchor computation failure is non-critical — the scope exists but its anchors
 * are incomplete. Search will not return secured results for this scope until
 * anchors are computed. There is no tracking record to update, so this handler
 * only logs the failure with error details.
 *
 * @param {PgBoss.Job<IComputeScopeAnchorsJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const computeScopeAnchorsFailedHandler: PgBoss.WorkHandler<IComputeScopeAnchorsJobData> = async (jobs) => {
  for (const job of jobs) {
    const { securityScopeId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IComputeScopeAnchorsJobData>).output;

    defaultLog.warn({
      label: 'computeScopeAnchorsFailedHandler',
      message: 'Compute scope anchors job failed after all retries',
      jobId: job.id,
      securityScopeId,
      output: jobOutput ?? 'Job failed after all retries'
    });
  }
};

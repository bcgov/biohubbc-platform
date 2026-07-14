import PgBoss from 'pg-boss';
import { SecurityScopeService } from '../../services/access-policy/security-scope-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

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
 * Each phase (stale delete, URN resolve, each insert batch) runs in its own
 * transaction via `runPhase`. This bounds WAL retention to one batch's worth
 * of writes instead of pinning WAL for the entire multi-minute loop.
 * ON CONFLICT DO NOTHING makes each batch idempotent — safe to retry on
 * partial failure.
 *
 * If the scope currently has no active approved ALLOW statement, the job exits
 * without deleting anchors. Access is controlled by `team_security_scope`; anchor
 * rows are reusable cache entries for when the same scope is granted again.
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

    try {
      // Phase 1: Resolve URN pattern
      const urn = await withConnection((conn) => new SecurityScopeService(conn).resolveUrnForScope(securityScopeId));

      if (!urn) {
        // No active approved ALLOW statement currently references this scope.
        // Anchors are reusable cache rows and do not grant access without
        // team_security_scope, so leave them in place for future reuse.
        defaultLog.info({
          label: 'computeScopeAnchorsJobHandler',
          message: 'Scope has no active approved ALLOW statements, anchor computation skipped',
          jobId: job.id,
          securityScopeId
        });
        continue;
      }

      // Phase 2: Delete stale anchors in keyset-paginated batches
      let staleLastId = 0;

      while (true) {
        const staleBatch = await withConnection((conn) =>
          new SecurityScopeService(conn).deleteStaleAnchorBatch(securityScopeId, staleLastId)
        );

        if (!staleBatch) {
          break;
        }

        staleLastId = staleBatch.pageLastId;
      }

      // Phase 3: Insert new anchors in keyset-paginated batches
      let lastId = 0;

      while (true) {
        const batch = await withConnection((conn) =>
          new SecurityScopeService(conn).computeAnchorBatch(securityScopeId, urn, lastId)
        );

        if (!batch) {
          break;
        }

        lastId = batch.pageLastId;
      }

      defaultLog.info({
        label: 'computeScopeAnchorsJobHandler',
        message: 'Compute scope anchors job completed successfully',
        jobId: job.id,
        securityScopeId
      });
    } catch (error) {
      defaultLog.error({
        label: 'computeScopeAnchorsJobHandler',
        message: 'Compute scope anchors job failed',
        jobId: job.id,
        securityScopeId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
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

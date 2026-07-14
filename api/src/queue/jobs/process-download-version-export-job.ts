import PgBoss from 'pg-boss';
import { PROCESS_START_STATUSES, TERMINAL_DOWNLOAD_STATUSES } from '../../constants/download-status';
import { getAPIUserDBConnection } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { getLogger } from '../../utils/logger';
import { IProcessDownloadVersionExportJobData } from '../publisher';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/process-download-version-export-job');

/**
 * Worker entry for group-keyed CSV export packaging.
 *
 * Standard worker shape: terminal-status guard → start-status guard →
 * `runExportGroup` (which owns pending→processing→ready transitions + the
 * streaming pipeline). Keyed on the shared artifact GROUP, so N user export
 * requests that dedupe onto one group package exactly once.
 * Retry-as-lifecycle: the main handler never writes FAILED — pg-boss retries
 * until exhausted, then the paired DLQ handler below writes FAILED on the group
 * with the job's error output.
 *
 * An upfront status guard keeps spurious retries quiet (pg-boss re-firing a
 * completed job hits the terminal branch and exits silently, no throw, no DLQ).
 * Unexpected statuses surface as a throw so they land in the DLQ where someone
 * can triage.
 */
export const processDownloadVersionExportJobHandler: PgBoss.WorkHandler<IProcessDownloadVersionExportJobData> = async (
  jobs
) => {
  for (const job of jobs) {
    const { downloadVersionExportArtifactGroupId } = job.data;

    defaultLog.info({
      label: 'processDownloadVersionExportJobHandler',
      message: 'Processing download version export job',
      jobId: job.id,
      downloadVersionExportArtifactGroupId
    });

    try {
      // Fetch once, up front, to drive the status guards. findExportArtifactGroup*
      // instead of getExportArtifactGroup* so a missing row surfaces as an
      // explicit throw below rather than a repository-level error message.
      const group = await withConnection(async (connection) =>
        new DownloadVersionExportRepository(connection).findExportArtifactGroupById(
          downloadVersionExportArtifactGroupId
        )
      );

      if (!group) {
        throw new Error(`Export artifact group ${downloadVersionExportArtifactGroupId} not found`);
      }

      const currentStatus = group.status;

      // Already complete — pg-boss re-fired a finished job, or the DLQ ran
      // after a late success. Exit cleanly to avoid fighting the state.
      if (TERMINAL_DOWNLOAD_STATUSES.includes(currentStatus)) {
        defaultLog.info({
          label: 'processDownloadVersionExportJobHandler',
          message: 'Export artifact group already in terminal status — skipping',
          jobId: job.id,
          downloadVersionExportArtifactGroupId,
          status: currentStatus
        });
        continue;
      }

      // Status is neither a start state nor terminal — unexpected.
      // Surface it: throw routes the job to the DLQ for triage.
      if (!PROCESS_START_STATUSES.includes(currentStatus)) {
        throw new Error(
          `Export artifact group ${downloadVersionExportArtifactGroupId} in unexpected status '${currentStatus}' — cannot start processing`
        );
      }

      // Hand off to the pipeline. `runExportGroup` owns its own transitions and
      // holds a single `withConnection` for the duration — the streaming
      // archiver + S3 multipart upload work is long-lived and doesn't benefit
      // from per-phase connection cycling.
      await withConnection(async (connection) => {
        await new DownloadExportPipelineService(connection).runExportGroup(downloadVersionExportArtifactGroupId);
      });

      defaultLog.info({
        label: 'processDownloadVersionExportJobHandler',
        message: 'Download version export job completed successfully',
        jobId: job.id,
        downloadVersionExportArtifactGroupId
      });
    } catch (error) {
      defaultLog.error({
        label: 'processDownloadVersionExportJobHandler',
        message: 'Download version export job failed',
        jobId: job.id,
        downloadVersionExportArtifactGroupId,
        error
      });
      throw error; // pg-boss retries per queue config; terminal failure lands in DLQ
    }
  }
};

/**
 * Dead Letter Queue handler for failed download version export jobs.
 *
 * Records the failure on the GROUP so every user export attached to it surfaces
 * as failed in one write — lifecycle state lives on the group, not the per-user
 * export. Mirror-image terminal guard: if the group is already in a terminal
 * status (success beat retry exhaustion, or a previous DLQ firing already marked
 * it failed), exit silently. A genuinely-missing group is also a no-op — there's
 * nothing to transition, and `find*` (not `get*`) is used here on purpose:
 * throwing on a vanished group would put pg-boss into a DLQ retry loop.
 *
 * Otherwise transitions the group to `failed` with the job output as error
 * metadata.
 */
export const processDownloadVersionExportFailedHandler: PgBoss.WorkHandler<
  IProcessDownloadVersionExportJobData
> = async (jobs) => {
  for (const job of jobs) {
    const { downloadVersionExportArtifactGroupId } = job.data;
    const jobOutput = (job as PgBoss.JobWithMetadata<IProcessDownloadVersionExportJobData>).output;

    defaultLog.warn({
      label: 'processDownloadVersionExportFailedHandler',
      message: 'Processing failed download version export job from dead letter queue',
      jobId: job.id,
      downloadVersionExportArtifactGroupId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const group = await new DownloadVersionExportRepository(connection).findExportArtifactGroupById(
        downloadVersionExportArtifactGroupId
      );

      if (!group) {
        defaultLog.warn({
          label: 'processDownloadVersionExportFailedHandler',
          message: 'Export artifact group not found — skipping DLQ transition',
          jobId: job.id,
          downloadVersionExportArtifactGroupId
        });
        await connection.commit();
        continue;
      }

      if (TERMINAL_DOWNLOAD_STATUSES.includes(group.status)) {
        defaultLog.info({
          label: 'processDownloadVersionExportFailedHandler',
          message: 'Export artifact group already in terminal status — skipping DLQ transition',
          jobId: job.id,
          downloadVersionExportArtifactGroupId,
          status: group.status
        });
        await connection.commit();
        continue;
      }

      await new DownloadExportPipelineService(connection).transitionGroupStatus(
        downloadVersionExportArtifactGroupId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: typeof jobOutput === 'string' ? jobOutput : 'Job failed after all retries' }
      );

      await connection.commit();

      defaultLog.info({
        label: 'processDownloadVersionExportFailedHandler',
        message: 'Failed download version export job status updated',
        jobId: job.id,
        downloadVersionExportArtifactGroupId
      });
    } catch (error) {
      await connection.rollback();
      defaultLog.error({
        label: 'processDownloadVersionExportFailedHandler',
        message: 'Failed to update failed download version export job status',
        jobId: job.id,
        downloadVersionExportArtifactGroupId,
        error
      });
      throw error;
    } finally {
      connection.release();
    }
  }
};

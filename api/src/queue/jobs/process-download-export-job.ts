import PgBoss from 'pg-boss';
import { PROCESS_START_STATUSES, TERMINAL_DOWNLOAD_STATUSES } from '../../constants/download-status';
import { getAPIUserDBConnection } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/process-download-export-job');

/**
 * Process download export job data.
 * Contains the download_export ID whose per-feature-type Parquet artifacts will
 * be converted into CSV part-zips.
 */
export interface IProcessDownloadExportJobData {
  /** The download_export ID to process. */
  downloadExportId: string;
}

/**
 * Worker entry for CSV export packaging.
 *
 * Shape mirrors `processDownloadJobHandler`: terminal-status guard →
 * start-status guard → `runExport` (which owns pending→processing→ready
 * transitions + the streaming pipeline). Retry-as-lifecycle: the main handler
 * never writes FAILED — pg-boss retries until exhausted, then the paired DLQ
 * handler below writes FAILED with the job's error output.
 *
 * An upfront status guard keeps spurious retries quiet (pg-boss re-firing a
 * completed job hits the terminal branch and exits silently, no throw, no
 * DLQ). Unexpected statuses surface as a throw so they land in the DLQ where
 * someone can triage.
 */
export const processDownloadExportJobHandler: PgBoss.WorkHandler<IProcessDownloadExportJobData> = async (jobs) => {
  for (const job of jobs) {
    const { downloadExportId } = job.data;

    defaultLog.info({
      label: 'processDownloadExportJobHandler',
      message: 'Processing download export job',
      jobId: job.id,
      downloadExportId
    });

    try {
      // Fetch once, up front, to drive the status guards. findExport* instead
      // of getExport* so a missing row surfaces as an explicit throw below
      // rather than a repository-level error message.
      const exportRecord = await withConnection(async (connection) =>
        new DownloadExportRepository(connection).findDownloadExportById(downloadExportId)
      );

      if (!exportRecord) {
        throw new Error(`Download export ${downloadExportId} not found`);
      }

      const currentStatus = exportRecord.status;

      // Already complete — pg-boss re-fired a finished job, or the DLQ ran
      // after a late success. Exit cleanly to avoid fighting the state.
      if (TERMINAL_DOWNLOAD_STATUSES.includes(currentStatus)) {
        defaultLog.info({
          label: 'processDownloadExportJobHandler',
          message: 'Download export already in terminal status — skipping',
          jobId: job.id,
          downloadExportId,
          status: currentStatus
        });
        continue;
      }

      // Status is neither a start state nor terminal — unexpected.
      // Surface it: throw routes the job to the DLQ for triage.
      if (!PROCESS_START_STATUSES.includes(currentStatus)) {
        throw new Error(
          `Download export ${downloadExportId} in unexpected status '${currentStatus}' — cannot start processing`
        );
      }

      // Hand off to the pipeline. `runExport` owns its own transitions and
      // holds a single `withConnection` for the duration — the streaming
      // archiver + S3 multipart upload work is long-lived and doesn't benefit
      // from per-phase connection cycling.
      await withConnection(async (connection) => {
        await new DownloadExportPipelineService(connection).runExport(downloadExportId);
      });

      defaultLog.info({
        label: 'processDownloadExportJobHandler',
        message: 'Download export job completed successfully',
        jobId: job.id,
        downloadExportId
      });
    } catch (error) {
      defaultLog.error({
        label: 'processDownloadExportJobHandler',
        message: 'Download export job failed',
        jobId: job.id,
        downloadExportId,
        error
      });
      throw error; // pg-boss retries per queue config; terminal failure lands in DLQ
    }
  }
};

/**
 * Dead Letter Queue handler for failed download export jobs.
 *
 * Mirror-image terminal guard: if the export is already in a terminal status
 * (success beat retry exhaustion, or a previous DLQ firing already marked it
 * failed), exit silently. Missing row is also a no-op — nothing to transition,
 * and throwing would put pg-boss in a DLQ retry loop.
 *
 * Otherwise transitions the export to `failed` with the job output as error
 * metadata.
 */
export const processDownloadExportFailedHandler: PgBoss.WorkHandler<IProcessDownloadExportJobData> = async (jobs) => {
  for (const job of jobs) {
    const { downloadExportId } = job.data;
    const jobOutput = (job as PgBoss.JobWithMetadata<IProcessDownloadExportJobData>).output;

    defaultLog.warn({
      label: 'processDownloadExportFailedHandler',
      message: 'Processing failed download export job from dead letter queue',
      jobId: job.id,
      downloadExportId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const exportRecord = await new DownloadExportRepository(connection).findDownloadExportById(downloadExportId);

      if (!exportRecord) {
        defaultLog.warn({
          label: 'processDownloadExportFailedHandler',
          message: 'Download export not found — skipping DLQ transition',
          jobId: job.id,
          downloadExportId
        });
        await connection.commit();
        continue;
      }

      if (TERMINAL_DOWNLOAD_STATUSES.includes(exportRecord.status)) {
        defaultLog.info({
          label: 'processDownloadExportFailedHandler',
          message: 'Download export already in terminal status — skipping DLQ transition',
          jobId: job.id,
          downloadExportId,
          status: exportRecord.status
        });
        await connection.commit();
        continue;
      }

      await new DownloadExportPipelineService(connection).transitionExportStatus(
        downloadExportId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: typeof jobOutput === 'string' ? jobOutput : 'Job failed after all retries' }
      );

      await connection.commit();

      defaultLog.info({
        label: 'processDownloadExportFailedHandler',
        message: 'Failed download export job status updated',
        jobId: job.id,
        downloadExportId
      });
    } catch (error) {
      await connection.rollback();
      defaultLog.error({
        label: 'processDownloadExportFailedHandler',
        message: 'Failed to update failed download export job status',
        jobId: job.id,
        downloadExportId,
        error
      });
      throw error;
    } finally {
      connection.release();
    }
  }
};

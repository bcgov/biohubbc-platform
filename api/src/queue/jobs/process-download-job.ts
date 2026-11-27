import PgBoss from 'pg-boss';
import { PROCESS_START_STATUSES, TERMINAL_DOWNLOAD_STATUSES } from '../../constants/download-status';
import { getAPIUserDBConnection } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/process-download-job');

/**
 * Process download job data interface.
 *
 * Carries the download version — the version is the unit of materialization, so a
 * re-run enqueues independent work against its own version that can't collide with
 * an earlier version's job. The owning download id is derived from the version row.
 */
export interface IProcessDownloadJobData {
  /** The download version to materialize. */
  downloadVersionId: string;
}

/**
 * Parquet-only worker for packaging selected features into per-feature-type
 * Parquet files on S3.
 *
 * Shape: terminal guard → start-status guard → transition-to-processing →
 * store the version's feature set → per-type Parquet write from that set →
 * transition-to-ready.
 *
 * The upfront status guard keeps spurious retries quiet (pg-boss re-firing a
 * completed job hits the terminal branch and exits silently, no throw, no
 * DLQ). Unexpected statuses surface as a throw so they land in the DLQ where
 * someone can triage.
 *
 * Retry semantics:
 * - Per-phase `withConnection` means completed phases survive retries — S3 overwrites
 *   are idempotent; artifact + download_artifact inserts use ON CONFLICT DO NOTHING.
 * - The feature set is stored once, by the first attempt that reaches the store. A retry
 *   reuses it and rewrites every file from it, so the files of all attempts hold the same
 *   features.
 * - `PROCESSING` is in `PROCESS_START_STATUSES` and in the pending→processing
 *   transition's allowed sources, so mid-job retries re-enter cleanly after a
 *   worker crash.
 * - Disallowing `ready` as a source for the processing→ready transition means a
 *   bug that drops us into the final transition mid-flight throws loudly.
 *
 * @param {PgBoss.Job<IProcessDownloadJobData>[]} jobs - The jobs to process.
 * @return {Promise<void>}
 */
export const processDownloadJobHandler: PgBoss.WorkHandler<IProcessDownloadJobData> = async (jobs) => {
  for (const job of jobs) {
    const { downloadVersionId } = job.data;

    defaultLog.info({
      label: 'processDownloadJobHandler',
      message: 'Processing download job',
      jobId: job.id,
      downloadVersionId
    });

    try {
      // Fetch the version once, up front, to drive the status guards. The version IS the unit
      // of materialization; its lifecycle status lives on the version row, not the download.
      const version = await withConnection(async (connection) =>
        new DownloadVersionRepository(connection).getDownloadVersion(downloadVersionId)
      );

      // The owning download id is still needed for the parquet S3 key and the download source.
      const downloadId = version.download_id;

      const currentStatus = version.status;

      // Already complete — pg-boss re-fired a finished job, or the DLQ ran after
      // a late success. Nothing to do; exit cleanly so we don't fight the state.
      if (TERMINAL_DOWNLOAD_STATUSES.includes(currentStatus)) {
        defaultLog.info({
          label: 'processDownloadJobHandler',
          message: 'Download version already in terminal status — skipping',
          jobId: job.id,
          downloadVersionId,
          downloadStatus: currentStatus
        });
        continue;
      }

      // Status is neither a start state nor terminal — something unexpected.
      // Surface it: throw puts the job in the DLQ where someone can triage.
      if (!PROCESS_START_STATUSES.includes(currentStatus)) {
        throw new Error(
          `Download version ${downloadVersionId} in unexpected status '${currentStatus}' — cannot start processing`
        );
      }

      // Transition → processing. Accepts PROCESSING as a source because a
      // mid-job retry after a crash re-enters this block with the row already
      // in processing; the transition is a no-op re-entry.
      await withConnection(async (connection) => {
        await new DownloadPipelineService(connection).transitionDownloadVersionStatus(
          downloadVersionId,
          DownloadStatusEnum.PROCESSING,
          [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING]
        );
      });

      const source = await withConnection(async (connection) =>
        new DownloadRepository(connection).getDownloadSource(downloadId)
      );

      const { schemaLookup, featureTypes, statements } = await withConnection(async (connection) =>
        new DownloadPipelineService(connection).resolveParquetSchema(source)
      );

      // Resolve the version's feature set once and store it on the version, before any file is
      // written. The policy expression, the current and closure rules and the security filter for
      // `requested_by` are evaluated here and nowhere else. The set is stored only while the
      // version has none: a mid-job retry (or a second worker on the same version) stores nothing
      // and reads back the set of the first attempt, so `featureCount` is the same on every attempt.
      //
      // The feature types that get a file are read in the same transaction: the statements'
      // feature types plus every feature type present in the stored set. Statements are re-read on
      // each attempt, so a retry can resolve fewer of them than the attempt that stored the set,
      // and every feature in the set must still land in a file. A type with a statement and no
      // features gets its empty file.
      const { featureCount, featureTypeNames } = await withConnection(async (connection) => {
        const pipelineService = new DownloadPipelineService(connection);
        const featureCount = await pipelineService.storeDownloadVersionFeatureSet({
          downloadVersionId,
          source,
          statements
        });
        const featureTypeNames = await pipelineService.listDownloadVersionFileFeatureTypeNames(
          downloadVersionId,
          featureTypes
        );

        return { featureCount, featureTypeNames };
      });

      // Write one Parquet file per feature type, each from the stored set. Each write runs in its
      // own transaction so completed types survive retries — S3 overwrites are idempotent, and the
      // artifact + download_artifact inserts use ON CONFLICT DO NOTHING. A mid-job retry re-runs
      // the whole loop and rewrites every file at the same key from the same stored set, so the
      // re-writes converge to the same state.
      for (const featureTypeName of featureTypeNames) {
        await withConnection(async (connection) => {
          const properties = schemaLookup.get(featureTypeName) ?? [];
          await new DownloadPipelineService(connection).writeFeatureTypeParquet({
            downloadId,
            downloadVersionId,
            properties,
            featureTypeName
          });
        });
      }

      // The version's feature count is the size of its stored set.
      await withConnection(async (connection) => {
        await new DownloadPipelineService(connection).transitionDownloadVersionStatus(
          downloadVersionId,
          DownloadStatusEnum.READY,
          [DownloadStatusEnum.PROCESSING],
          { featureCount }
        );
      });

      defaultLog.info({
        label: 'processDownloadJobHandler',
        message: 'Download job completed successfully',
        jobId: job.id,
        downloadVersionId
      });
    } catch (error) {
      defaultLog.error({
        label: 'processDownloadJobHandler',
        message: 'Download job failed',
        jobId: job.id,
        downloadVersionId,
        error
      });
      throw error; // pg-boss retries per queue config; terminal failure lands in DLQ
    }
  }
};

/**
 * Dead Letter Queue handler for failed download jobs.
 *
 * Mirror-image terminal guard: if the download version is already in a terminal status
 * (success happened before retries exhausted, or a previous DLQ firing already
 * marked it failed), exit silently so we don't re-transition a finished version.
 *
 * Otherwise transitions the version to `failed` with the job output as error
 * metadata. The version is created in the same transaction as its download, so a
 * lookup miss is an unreachable invariant violation; it propagates as a thrown
 * error rather than being swallowed.
 *
 * @param {PgBoss.Job<IProcessDownloadJobData>[]} jobs - The failed jobs (post-retry).
 * @return {Promise<void>}
 */
export const processDownloadFailedHandler: PgBoss.WorkHandler<IProcessDownloadJobData> = async (jobs) => {
  for (const job of jobs) {
    const { downloadVersionId } = job.data;
    const jobOutput = (job as PgBoss.JobWithMetadata<IProcessDownloadJobData>).output;

    defaultLog.warn({
      label: 'processDownloadFailedHandler',
      message: 'Processing failed download job from dead letter queue',
      jobId: job.id,
      downloadVersionId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const version = await new DownloadVersionRepository(connection).getDownloadVersion(downloadVersionId);

      if (TERMINAL_DOWNLOAD_STATUSES.includes(version.status)) {
        defaultLog.info({
          label: 'processDownloadFailedHandler',
          message: 'Download version already in terminal status — skipping DLQ transition',
          jobId: job.id,
          downloadVersionId,
          downloadStatus: version.status
        });
        await connection.commit();
        continue;
      }

      await new DownloadPipelineService(connection).transitionDownloadVersionStatus(
        downloadVersionId,
        DownloadStatusEnum.FAILED,
        [DownloadStatusEnum.PENDING, DownloadStatusEnum.PROCESSING],
        { error: typeof jobOutput === 'string' ? jobOutput : 'Job failed after all retries' }
      );

      await connection.commit();

      defaultLog.info({
        label: 'processDownloadFailedHandler',
        message: 'Failed download job status updated',
        jobId: job.id,
        downloadVersionId
      });
    } catch (error) {
      await connection.rollback();
      defaultLog.error({
        label: 'processDownloadFailedHandler',
        message: 'Failed to update failed download job status',
        jobId: job.id,
        downloadVersionId,
        error
      });
      throw error;
    } finally {
      connection.release();
    }
  }
};

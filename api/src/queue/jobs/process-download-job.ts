import PgBoss from 'pg-boss';
import { getAPIUserDBConnection } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
import { getLogger } from '../../utils/logger';
import { withConnection } from '../with-connection';

const defaultLog = getLogger('queue/jobs/process-download-job');

/**
 * Process download job data interface.
 * Contains the download ID for async packaging of selected features.
 */
export interface IProcessDownloadJobData {
  /** The download ID to process */
  downloadId: string;
}

/**
 * Process download job handler.
 *
 * Branches on `download.format` to select the processing pipeline:
 *
 * - **Parquet**: Streams from typed property tables into per-feature-type Parquet
 *   files on S3. Each feature type gets its own file because different types have
 *   different column schemas. Each type write runs in its own transaction so
 *   completed types survive retries (S3 writes are idempotent).
 *
 * - **CSV/zip (fragment pipeline)**: Streams from JSONB into fragmented zip
 *   archives. Fragments are planned, processed, and finalized independently.
 *
 * Each phase runs in its own `withConnection` to bound transaction lifetime
 * and allow partial progress to survive pg-boss retries.
 *
 * @param {PgBoss.Job<IProcessDownloadJobData>[]} jobs The jobs to process
 * @return {*}  {Promise<void>}
 */
export const processDownloadJobHandler: PgBoss.WorkHandler<IProcessDownloadJobData> = async (jobs) => {
  for (const job of jobs) {
    const { downloadId } = job.data;

    defaultLog.info({
      label: 'processDownloadJobHandler',
      message: 'Processing download job',
      jobId: job.id,
      downloadId
    });

    try {
      // Phase 1: Fetch the download record to determine which pipeline to use
      const download = await withConnection(async (connection) => {
        return new DownloadRepository(connection).findDownloadById(downloadId);
      });

      if (!download) {
        throw new Error(`Download ${downloadId} not found`);
      }

      if (download.format === 'parquet') {
        // --- Parquet pipeline ---
        // Streams from typed property tables into per-feature-type Parquet files.

        // Mark download as PROCESSING so started_at is recorded
        await withConnection(async (connection) => {
          await new DownloadPipelineService(connection).updateDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING);
        });

        // Resolve source + artifact info for S3 key construction
        const metadata = await withConnection(async (connection) => {
          return new DownloadPipelineService(connection).getDownloadMetadata(downloadId);
        });

        // Build schema lookup and discover which feature types are in this download
        const { schemaLookup, featureTypes } = await withConnection(async (connection) => {
          return new DownloadPipelineService(connection).resolveParquetSchema(downloadId, metadata.source);
        });

        // Write each feature type to its own Parquet file.
        // Different feature types have different column schemas — each gets its own file.
        // Each write is its own transaction so completed types survive retries.
        // S3 writes are idempotent — re-uploading the same key is safe.
        for (const featureTypeName of featureTypes) {
          await withConnection(async (connection) => {
            const properties = schemaLookup.get(featureTypeName) ?? [];
            return new DownloadPipelineService(connection).writeFeatureTypeParquet(
              downloadId,
              metadata.source,
              metadata.artifact,
              properties,
              featureTypeName
            );
          });
        }

        // Finalize: mark artifact as uploaded, download as READY
        await withConnection(async (connection) => {
          return new DownloadPipelineService(connection).finalizeParquetDownload(downloadId);
        });
      } else {
        // --- Fragment pipeline (CSV/zip) ---
        // Streams from JSONB into fragmented zip archives.

        // Plan fragments and get the list of work to do
        const fragments = await withConnection(async (connection) => {
          const pipelineService = new DownloadPipelineService(connection);
          await pipelineService.planDownloadIfNeeded(downloadId);
          return pipelineService.getFragmentsToProcess(downloadId);
        });

        // Mark download as PROCESSING so started_at is recorded
        await withConnection(async (connection) => {
          const pipelineService = new DownloadPipelineService(connection);
          await pipelineService.updateDownloadStatus(downloadId, DownloadStatusEnum.PROCESSING);
        });

        // Process each fragment
        for (const fragment of fragments) {
          // Mark fragment as PROCESSING for UI
          await withConnection(async (connection) => {
            const pipelineService = new DownloadPipelineService(connection);
            await pipelineService.markFragmentProcessing(fragment.download_fragment_id);
          });

          await withConnection(async (connection) => {
            const pipelineService = new DownloadPipelineService(connection);
            await pipelineService.processFragment(fragment, downloadId);
          });
        }

        // Finalize the parent download record
        await withConnection(async (connection) => {
          const pipelineService = new DownloadPipelineService(connection);
          await pipelineService.finalizeDownload(downloadId);
        });
      }

      defaultLog.info({
        label: 'processDownloadJobHandler',
        message: 'Download job completed successfully',
        jobId: job.id,
        downloadId
      });
    } catch (error) {
      defaultLog.error({
        label: 'processDownloadJobHandler',
        message: 'Download job failed',
        jobId: job.id,
        downloadId,
        error
      });

      throw error; // pg-boss will handle retry based on configuration
    }
  }
};

/**
 * Dead Letter Queue handler for failed download jobs.
 *
 * This handler is called after all retries are exhausted. It updates the
 * download status to 'failed' with error details.
 *
 * @param {PgBoss.Job<IProcessDownloadJobData>[]} jobs The failed jobs
 * @return {*}  {Promise<void>}
 */
export const processDownloadFailedHandler: PgBoss.WorkHandler<IProcessDownloadJobData> = async (jobs) => {
  for (const job of jobs) {
    const { downloadId } = job.data;

    // Cast to access output field available on failed jobs
    const jobOutput = (job as PgBoss.JobWithMetadata<IProcessDownloadJobData>).output;

    defaultLog.warn({
      label: 'processDownloadFailedHandler',
      message: 'Processing failed download job from dead letter queue',
      jobId: job.id,
      downloadId,
      output: jobOutput
    });

    const connection = getAPIUserDBConnection();

    try {
      await connection.open();

      const pipelineService = new DownloadPipelineService(connection);

      // Update download status to failed (all retries exhausted)
      await pipelineService.updateDownloadStatus(downloadId, DownloadStatusEnum.FAILED, {
        error: typeof jobOutput === 'string' ? jobOutput : 'Job failed after all retries'
      });

      await connection.commit();

      defaultLog.info({
        label: 'processDownloadFailedHandler',
        message: 'Failed download job status updated',
        jobId: job.id,
        downloadId
      });
    } catch (error) {
      await connection.rollback();

      defaultLog.error({
        label: 'processDownloadFailedHandler',
        message: 'Failed to update failed download job status',
        jobId: job.id,
        downloadId,
        error
      });

      throw error;
    } finally {
      connection.release();
    }
  }
};

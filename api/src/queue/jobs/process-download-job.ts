import PgBoss from 'pg-boss';
import { getAPIUserDBConnection, IDBConnection } from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadService } from '../../services/download-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('queue/jobs/process-download-job');

/**
 * Process download job data interface.
 * Contains the download ID for async packaging of selected features.
 */
export interface IProcessDownloadJobData {
  /** The download ID to process */
  downloadId: number;
  /** The user who initiated the download */
  systemUserId: number;
}

/**
 * Run a callback within a dedicated database transaction.
 *
 * Opens a connection, executes the callback, commits on success, rolls back on error.
 *
 * @param {(connection: IDBConnection) => Promise<T>} fn - The callback to execute.
 * @return {Promise<T>} The callback's return value.
 */
async function withConnection<T>(fn: (connection: IDBConnection) => Promise<T>): Promise<T> {
  const connection = getAPIUserDBConnection();

  try {
    await connection.open();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process download job handler.
 *
 * Orchestrates download processing in separate transactions per phase so that
 * completed work survives retries. On failure, only the current fragment's
 * transaction is rolled back — previously completed fragments remain committed.
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

    // Plan fragments and get the list of work to do
    const fragments = await withConnection(async (connection) => {
      const downloadService = new DownloadService(connection);
      await downloadService.planDownloadIfNeeded(downloadId);
      return downloadService.getFragmentsToProcess(downloadId);
    });

    // Process each fragment
    for (const fragment of fragments) {
      //Mark fragment as PROCESSING for UI
      await withConnection(async (connection) => {
        const downloadService = new DownloadService(connection);
        await downloadService.markFragmentProcessing(fragment.download_fragment_id);
      });

      await withConnection(async (connection) => {
        const downloadService = new DownloadService(connection);
        await downloadService.processFragment(fragment, downloadId);
      });
    }

    // Finalize the parent download record
    await withConnection(async (connection) => {
      const downloadService = new DownloadService(connection);
      await downloadService.finalizeDownload(downloadId);
    });

    defaultLog.info({
      label: 'processDownloadJobHandler',
      message: 'Download job completed successfully',
      jobId: job.id,
      downloadId
    });
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

      const downloadService = new DownloadService(connection);

      // Update download status to failed (all retries exhausted)
      await downloadService.updateDownloadStatus(downloadId, DownloadStatusEnum.FAILED, {
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

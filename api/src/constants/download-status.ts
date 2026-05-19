import { DownloadRecord } from '../models/download';

/**
 * Download statuses from which the worker is allowed to start processing.
 *
 * `processing` is included to make mid-job retries idempotent: if the worker
 * crashes after the pending→processing transition, pg-boss retries with the
 * row already in processing. The handler's guard lets it through; the
 * pending→processing transition is a no-op re-entry.
 */
export const PROCESS_START_STATUSES: DownloadRecord['download_status'][] = ['pending', 'processing'];

/**
 * Download statuses that represent a completed (terminal) download — no further work.
 *
 * A job that sees one of these at the top of the handler exits silently.
 * This catches two cases: pg-boss re-firing a completed job (rare timing
 * edge), and the DLQ firing against a download that succeeded before retries
 * exhausted.
 */
export const TERMINAL_DOWNLOAD_STATUSES: DownloadRecord['download_status'][] = ['ready', 'downloaded', 'failed'];

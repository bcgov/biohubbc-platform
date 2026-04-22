import { FRAGMENT_SIZE_THRESHOLD } from '../constants/download';
import { DownloadRecord } from '../models/download';
import { DownloadStatusEnum } from '../models/download-status';

/**
 * Test factory: build a DownloadRecord with sensible defaults. Callers override fields
 * that matter for the specific test.
 */
export const createMockDownloadRecord = (overrides?: Partial<DownloadRecord>): DownloadRecord => ({
  download_id: 'aaaa0000-0000-0000-0000-000000000042',
  download_status: DownloadStatusEnum.PROCESSING,
  format: 'parquet',
  metadata: null,
  started_at: null,
  completed_at: null,
  downloaded_at: null,
  total_fragments: 1,
  completed_fragments: 0,
  estimated_total_size_bytes: null,
  fragment_size_bytes: String(FRAGMENT_SIZE_THRESHOLD),
  create_date: '2026-01-01T00:00:00.000Z',
  ...overrides
});

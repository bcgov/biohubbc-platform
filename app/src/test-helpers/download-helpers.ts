import { DownloadRecord } from 'interfaces/useDownloadApi.interface';

/**
 * Test factory: build a DownloadRecord with sensible defaults.
 * Override any field that matters for the specific test.
 */
export const makeDownload = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
  download_id: 'abc-123',
  download_status: 'ready',
  create_date: '2026-03-01T00:00:00Z',
  feature_count: 42,
  total_fragments: 1,
  completed_fragments: 1,
  estimated_total_size_bytes: '1024',
  started_at: '2026-03-01T00:01:00Z',
  completed_at: '2026-03-01T00:02:00Z',
  downloaded_at: null,
  ...overrides
});

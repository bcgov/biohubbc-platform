import { DownloadRecord } from 'interfaces/useDownloadApi.interface';
import { DownloadExport } from 'interfaces/useDownloadExportApi.interface';

/**
 * Test factory: build a DownloadRecord with sensible defaults.
 * Override any field that matters for the specific test.
 */
export const makeDownload = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
  download_id: 'abc-123',
  download_version_id: 'ver-abc-123',
  download_status: 'ready',
  name: 'Example download',
  description: 'Example download description',
  create_date: '2026-03-01T00:00:00Z',
  started_at: '2026-03-01T00:01:00Z',
  completed_at: '2026-03-01T00:02:00Z',
  downloaded_at: null,
  exports: [],
  ...overrides
});

/**
 * Test factory: build a DownloadExport with sensible defaults (single-part ready).
 */
export const makeExport = (overrides: Partial<DownloadExport> = {}): DownloadExport => ({
  download_version_export_id: 'exp-abc-123',
  download_id: 'abc-123',
  format: 'csv',
  mode: 'per_feature_type',
  status: 'ready',
  max_part_size_bytes: '524288000',
  part_count: 1,
  started_at: '2026-04-22T00:00:00Z',
  completed_at: '2026-04-22T00:01:00Z',
  error_message: null,
  ...overrides
});

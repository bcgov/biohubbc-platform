import { DownloadListRecord, DownloadRecord } from '../models/download';
import { DownloadExportListRow } from '../models/download-export';
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
  create_date: '2026-01-01T00:00:00.000Z',
  ...overrides
});

/**
 * Test factory: build a DownloadListRecord (the service-output shape with `exports[]`).
 * Defaults to an empty exports array; callers override as needed.
 */
export const createMockDownloadListRecord = (overrides?: Partial<DownloadListRecord>): DownloadListRecord => ({
  ...createMockDownloadRecord(),
  exports: [],
  ...overrides
});

/**
 * Test factory: build a DownloadExportListRow (list-level export row with `part_count`).
 */
export const createMockDownloadExportListRow = (overrides?: Partial<DownloadExportListRow>): DownloadExportListRow => ({
  download_export_id: 'eeee0000-0000-0000-0000-000000000001',
  download_id: 'aaaa0000-0000-0000-0000-000000000042',
  format: 'csv',
  status: DownloadStatusEnum.READY,
  mode: 'per_feature_type',
  max_part_size_bytes: '524288000',
  started_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T00:01:00.000Z',
  error_message: null,
  part_count: 1,
  ...overrides
});

import { DownloadDetailRecord, DownloadListRecord } from '../models/download';
import { DownloadExportListRow } from '../models/download-export';
import { DownloadStatusEnum } from '../models/download-status';

/**
 * Test factory: build a DownloadDetailRecord with sensible defaults. Callers override
 * fields that matter for the specific test.
 *
 * Returns the detail shape (with `name` + `description`) since the repository's
 * `findDownloadById` always parses against that schema — the policy join is part
 * of the single SQL. A test fixture that returns the bare list-row shape would
 * lie about the runtime payload and force type contortions at every call site.
 * Callers wanting the list-row shape can structurally narrow with a type assertion
 * or omit the extra fields via `{ ...record, name: undefined, ... }` — but in
 * practice all production code paths consume the detail shape from this method.
 */
export const createMockDownloadRecord = (overrides?: Partial<DownloadDetailRecord>): DownloadDetailRecord => ({
  download_id: 'aaaa0000-0000-0000-0000-000000000042',
  download_status: DownloadStatusEnum.PROCESSING,
  format: 'parquet',
  metadata: null,
  started_at: null,
  completed_at: null,
  downloaded_at: null,
  create_date: '2026-01-01T00:00:00.000Z',
  name: 'Test download',
  description: null,
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

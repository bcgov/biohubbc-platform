import { DownloadDetailRecord, DownloadListRecord } from '../models/download';
import { DownloadStatusEnum } from '../models/download-status';
import { DownloadVersionRecord, DownloadVersionStatusRecord } from '../models/download-version';
import { DownloadVersionExportListRow, DownloadVersionExportRow } from '../models/download-version-export';
import { DownloadVersionExportArtifactGroupRecord } from '../models/download-version-export-artifact-group';

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
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
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
 * Test factory: build a DownloadVersionExportListRow (list-level export row with `part_count`).
 */
export const createMockDownloadVersionExportListRow = (
  overrides?: Partial<DownloadVersionExportListRow>
): DownloadVersionExportListRow => ({
  download_version_export_id: 'eeee0000-0000-0000-0000-000000000001',
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
  download_version_export_artifact_group_id: 'cccc0000-0000-0000-0000-000000000001',
  format: 'csv',
  mode: 'per_feature_type',
  max_part_size_bytes: '524288000',
  download_id: 'aaaa0000-0000-0000-0000-000000000042',
  status: DownloadStatusEnum.READY,
  started_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T00:01:00.000Z',
  error_message: null,
  part_count: 1,
  ...overrides
});

/**
 * Test factory: build a DownloadVersionRecord (the thin version row returned by
 * the INSERT RETURNING / find-by-id).
 */
export const createMockDownloadVersion = (overrides?: Partial<DownloadVersionRecord>): DownloadVersionRecord => ({
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
  download_id: 'aaaa0000-0000-0000-0000-000000000042',
  ...overrides
});

/**
 * Test factory: build a DownloadVersionStatusRecord (the version's materialization-lifecycle row
 * returned by `getDownloadVersionStatusById`). The version owns the lifecycle, so callers override
 * `status` (and timing/error fields) to drive transition tests.
 */
export const createMockDownloadVersionStatusRecord = (
  overrides?: Partial<DownloadVersionStatusRecord>
): DownloadVersionStatusRecord => ({
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
  download_id: 'aaaa0000-0000-0000-0000-000000000042',
  status: DownloadStatusEnum.PENDING,
  started_at: null,
  completed_at: null,
  materialized_at: null,
  error_message: null,
  ...overrides
});

/**
 * Test factory: build a DownloadVersionExportArtifactGroupRecord (the materialized
 * group that carries the export lifecycle status/timing/error).
 */
export const createMockExportArtifactGroup = (
  overrides?: Partial<DownloadVersionExportArtifactGroupRecord>
): DownloadVersionExportArtifactGroupRecord => ({
  download_version_export_artifact_group_id: 'cccc0000-0000-0000-0000-000000000001',
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
  format: 'csv',
  mode: 'per_feature_type',
  max_part_size_bytes: '524288000',
  exporter_version: 1,
  status: DownloadStatusEnum.READY,
  started_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T00:01:00.000Z',
  error_message: null,
  ...overrides
});

/**
 * Test factory: build a DownloadVersionExportRow (the thin export row returned by
 * the create path). Tests needing the full record can compose the group fields on top.
 */
export const createMockDownloadVersionExport = (
  overrides?: Partial<DownloadVersionExportRow>
): DownloadVersionExportRow => ({
  download_version_export_id: 'eeee0000-0000-0000-0000-000000000001',
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
  download_version_export_artifact_group_id: 'cccc0000-0000-0000-0000-000000000001',
  format: 'csv',
  mode: 'per_feature_type',
  max_part_size_bytes: '524288000',
  ...overrides
});

import {
  EXPORT_CONFIG_VERSION,
  EXPORT_TYPE,
  ExportMode,
  MergeType
} from 'constants/export-config-constants';

/**
 * Status values a `download_export` row can take.
 *
 * No `'downloaded'` state — that's a `download`-only terminal; exports don't transition there.
 */
export type DownloadExportStatus = 'pending' | 'processing' | 'ready' | 'failed';

/**
 * A single export row, as embedded in `DownloadRecord.exports` and returned by `POST /api/download/:id/export`.
 */
export interface DownloadExport {
  download_version_export_id: string;
  download_id: string;
  format: 'csv';
  mode: ExportMode;
  status: DownloadExportStatus;
  /**
   * Max size per part-zip in bytes. Serialized as a bigint-string to match the backend's numeric encoding.
   */
  max_part_size_bytes: string;
  /**
   * Number of part-zips produced. Zero for non-ready or zero-row exports.
   * Used by the card to choose single- vs multi-part UI without a second `getExport` round-trip.
   */
  part_count: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

/**
 * A single part-zip within a ready export. `url` is a freshly-minted presigned URL — callers must not cache it.
 */
export interface DownloadExportPart {
  chunk_id: number;
  file_size_bytes: string;
  url: string;
}

/**
 * Detail response for `GET /api/download-export/:exportId` — same shape as `DownloadExport` plus per-part URLs.
 * URLs regenerate per request; never persist them.
 */
export interface DownloadExportDetail extends DownloadExport {
  parts: DownloadExportPart[];
}

/**
 * A single join in the export recipe. Wires one feature type's column to another so denormalized
 * mode can flatten related features into one row. `merge_type` is `'left'` only this release — the
 * left side's rows are always kept and unmatched right-side columns come back empty.
 */
export interface MergeStep {
  left_feature_type: string;
  left_column: string;
  right_feature_type: string;
  right_column: string;
  merge_type: MergeType;
}

/**
 * Selects one column of one feature type for the CSV output. `output_column` overrides the header;
 * omit it and the server defaults to `{feature_type}_{column}` so headers stay unique across merged
 * feature types.
 */
export interface OutputColumn {
  feature_type: string;
  column: string;
  output_column?: string;
}

/**
 * The recipe that drives a CSV export: which feature types to pull, how to join them, and which
 * columns to emit. `per_feature_type` writes one CSV per type; `denormalized` flattens everything
 * onto `root_feature_type` via `merge_steps`. Sent as-is to `POST /api/download/:id/export`.
 */
export interface ExportConfig {
  version: typeof EXPORT_CONFIG_VERSION;
  export_type: typeof EXPORT_TYPE;
  mode: ExportMode;
  root_feature_type?: string;
  feature_types: string[];
  merge_steps: MergeStep[];
  output_columns?: OutputColumn[];
}

/**
 * One materialized feature type of a download plus its exportable columns (structural + schema-header),
 * as returned by `GET /api/download/:id/feature-types`. Drives the config picker.
 */
export interface DownloadFeatureType {
  feature_type: string;
  columns: string[];
}

/**
 * Payload for `POST /api/download/:id/export` — the full export config plus an optional part-size cap.
 */
export interface CreateExportPayload extends ExportConfig {
  /**
   * The active download version the export is built from. Required — a committed download always
   * has at least one active version, and the backend rejects a body without it.
   */
  download_version_id: string;
  /**
   * Max size per part-zip in bytes. Backend enforces 5 MiB–5 GiB.
   * Omit to use the server-side default (500 MB).
   */
  max_part_size_bytes?: number;
}

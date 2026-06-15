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
  mode: 'per_feature_type' | 'denormalized';
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
 * Payload for `POST /api/download/:id/export`.
 */
export interface CreateExportPayload {
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

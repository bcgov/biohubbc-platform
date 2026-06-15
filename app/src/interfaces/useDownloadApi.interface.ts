import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { DownloadExport } from 'interfaces/useDownloadExportApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * Lifecycle status of a download. Mirrors the backend `download.download_status`
 * enum and the GET /api/download/:downloadId `status` field.
 */
export type DownloadStatus = 'pending' | 'processing' | 'ready' | 'downloaded' | 'failed';

/**
 * A download record as returned by GET /api/download.
 */
export interface DownloadRecord {
  download_id: string;
  download_version_id: string;
  download_status: DownloadStatus;
  create_date: string;
  feature_count: number;
  started_at: string | null;
  completed_at: string | null;
  downloaded_at: string | null;
  /**
   * CSV exports for this download. Pre-joined on the list response by the backend
   * (`json_agg(ORDER BY create_date DESC)`) so the card never needs a second round-trip.
   * Empty array when the download has no exports.
   */
  exports: DownloadExport[];
}

/**
 * A download detail record as returned by GET /api/download/:downloadId.
 *
 * The route renames `download_status` to `status` and joins the owning policy
 * to surface `name` (always present) and `description` (nullable) for the
 * public download page header.
 */
export interface DownloadDetail {
  download_id: string;
  download_version_id: string;
  status: DownloadStatus;
  name: string;
  description: string | null;
  started_at: string | null;
  completed_at: string | null;
  downloaded_at: string | null;
}

/**
 * Response from GET /api/download.
 * Includes server-side pagination metadata alongside the data array.
 */
export interface DownloadListResponse {
  downloads: DownloadRecord[];
  pagination: ApiPaginationResponseParams;
}

/**
 * Body for POST /api/download.
 *
 * `expression` is sent as a literal `null` when no filter expression is applied. The backend
 * schema marks the key `.nullable()` (not `.optional()`), so omitting it yields a 400.
 */
export interface CreateDownloadRequest {
  name: string;
  description?: string | null;
  featureTypes: string[];
  expression: ExpressionTreeExpression | null;
}

/**
 * Response from POST /api/download. The worker job id and a presigned URL the caller can poll
 * once the export is ready.
 */
export interface CreateDownloadResponse {
  download_id: string;
  download_url: string;
}

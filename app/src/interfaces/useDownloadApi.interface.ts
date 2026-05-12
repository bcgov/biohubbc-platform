import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { DownloadExport } from 'interfaces/useDownloadExportApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * A download record as returned by GET /api/download.
 */
export interface DownloadRecord {
  download_id: string;
  download_status: 'pending' | 'processing' | 'ready' | 'downloaded' | 'failed';
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

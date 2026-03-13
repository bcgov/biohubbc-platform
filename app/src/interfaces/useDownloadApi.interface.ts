import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * A download record as returned by GET /api/download.
 */
export interface DownloadRecord {
  download_id: string;
  download_status: 'pending' | 'processing' | 'ready' | 'downloaded' | 'failed';
  create_date: string;
  feature_count: number;
  total_fragments: number;
  completed_fragments: number;
  estimated_total_size_bytes: string | null;
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
 * Response from GET /api/download/{downloadId}/fragment/{fragmentIndex}/url.
 */
export interface FragmentUrlResponse {
  url: string;
}

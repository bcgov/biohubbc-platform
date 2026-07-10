import { DownloadStatus } from 'interfaces/useDownloadApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';

/**
 * A download tile as returned by GET /api/gallery/slug/:slug/download.
 *
 * The backend joins the owning policy to surface `name` (always present) and
 * `description` (nullable). `feature_count` is nullable — versions materialized
 * before counting existed carry no count, and the tile omits the count line.
 */
export interface GalleryDownloadTile {
  download_id: string;
  download_version_id: string;
  download_status: DownloadStatus;
  format: string;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  downloaded_at: string | null;
  create_date: string;
  name: string;
  description: string | null;
  feature_count: number | null;
}

/**
 * Response from GET /api/gallery/slug/:slug/download.
 * Includes server-side pagination metadata alongside the data array.
 */
export interface GalleryDownloadsResponse {
  downloads: GalleryDownloadTile[];
  pagination: ApiPaginationResponseParams;
}

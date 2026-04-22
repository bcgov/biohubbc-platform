import { SIGNED_URL_EXPIRY_FRAGMENT } from '../../constants/download';
import { IDBConnection } from '../../database/db';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { CreateDownloadExportRequest, DownloadExportListRow, DownloadExportRecord } from '../../models/download-export';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { DownloadService } from './download-service';

/**
 * Default chunk size — matches `download.fragment_size_bytes` default (500 MB).
 * Changes here MUST coordinate with the DB column default in migration
 * `20260422133033_download_export_chunk_size_and_mode.ts` and with
 * `FRAGMENT_SIZE_THRESHOLD` in `constants/download`.
 */
const DEFAULT_CHUNK_SIZE_BYTES = '524288000';

/**
 * Shape of a single entry in the detail endpoint's `parts[]` response.
 *
 * `byte_size` is renamed to `file_size_bytes` here to match the legacy
 * fragment-endpoint response shape the frontend already consumes.
 */
export interface DownloadExportPart {
  chunk_id: number | null;
  file_size_bytes: string;
  url: string;
}

/**
 * Request-time service for download exports.
 *
 * Owns the CRUD operations called by path handlers: create-with-defaults,
 * list, get, authorize, and presigned-URL assembly. Background pipeline work
 * lives in `DownloadExportPipelineService`.
 *
 * @export
 * @class DownloadExportService
 * @extends {DBService}
 */
export class DownloadExportService extends DBService {
  downloadExportRepository: DownloadExportRepository;
  downloadService: DownloadService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadExportRepository = new DownloadExportRepository(connection);
    this.downloadService = new DownloadService(connection);
  }

  /**
   * Create a CSV export for a ready download.
   *
   * `chunk_size_bytes` lives per-export so a single download can be re-exported
   * at different chunk sizes without re-running the Parquet pipeline —
   * `download.fragment_size_bytes` is the write-side knob, this is the read-side
   * knob. `format` is hard-coded to `'csv'` and `mode` to `'per_feature_type'`
   * here because this ticket ships the single-shape contract; a future
   * denormalized-mode addition opens `mode` at the request layer.
   *
   * Exports are authenticated-only (HTTP403 when `systemUserId` is null) and
   * require team membership on the parent download — delegates to
   * `DownloadService.getAuthorizedDownload` so the team-auth rule lives in
   * exactly one place. Only `ready` downloads can export; `pending` /
   * `processing` / `failed` parents surface 409 and the client retries after
   * the parent finishes.
   *
   * Does NOT publish the pg-boss job — route handlers publish inside the same
   * transaction as the insert so enqueue and row creation succeed together.
   */
  async createDownloadExport(
    downloadId: string,
    systemUserId: number | null,
    request: CreateDownloadExportRequest
  ): Promise<DownloadExportRecord> {
    if (systemUserId === null) {
      throw new HTTP403('Access denied');
    }

    // Throws HTTP403 / HTTP404 as appropriate.
    const download = await this.downloadService.getAuthorizedDownload(downloadId, systemUserId);

    if (download.download_status !== DownloadStatusEnum.READY) {
      throw new HTTP409('Download is not ready — cannot export');
    }

    return this.downloadExportRepository.createDownloadExport({
      download_id: downloadId,
      format: 'csv',
      mode: 'per_feature_type',
      chunk_size_bytes: request.chunk_size_bytes ?? DEFAULT_CHUNK_SIZE_BYTES
    });
  }

  /**
   * List exports for a download, newest first, with `part_count` per row.
   */
  async listExportsByDownloadId(downloadId: string): Promise<DownloadExportListRow[]> {
    return this.downloadExportRepository.listDownloadExportsByDownloadId(downloadId);
  }

  /**
   * Get an export by ID, throwing if not found.
   */
  async getExportById(exportId: string): Promise<DownloadExportRecord> {
    return this.downloadExportRepository.getDownloadExportById(exportId);
  }

  /**
   * Authorize a user for an export.
   *
   * Exports are authenticated-only — the Parquet download is the unauthenticated
   * path and anonymous UUID holders must `PUT /api/download/:id` to claim
   * before they can export. Delegates team-membership checks to
   * `DownloadService.getAuthorizedDownload` so the team-auth rule lives in
   * exactly one place.
   */
  async getAuthorizedExport(exportId: string, systemUserId: number | null): Promise<DownloadExportRecord> {
    if (systemUserId === null) {
      throw new HTTP403('Access denied');
    }

    const exportRecord = await this.downloadExportRepository.getDownloadExportById(exportId);
    await this.downloadService.getAuthorizedDownload(exportRecord.download_id, systemUserId);

    return exportRecord;
  }

  /**
   * Build the `parts[]` array for the detail endpoint response.
   *
   * One presigned URL per part-zip, signed at request time with the same TTL
   * as fragment URLs. The `byte_size → file_size_bytes` rename matches the
   * legacy fragment response shape the frontend already consumes.
   */
  async listExportPartUrls(exportId: string): Promise<DownloadExportPart[]> {
    const artifacts = await this.downloadExportRepository.listDownloadExportArtifactsByExportId(exportId);
    const objectStorageService = new ObjectStorageService();

    return Promise.all(
      artifacts.map(async (artifact) => ({
        chunk_id: artifact.chunk_id,
        file_size_bytes: artifact.byte_size,
        url: await objectStorageService.getSignedUrl(BucketType.MAIN, artifact.object_key, SIGNED_URL_EXPIRY_FRAGMENT)
      }))
    );
  }
}

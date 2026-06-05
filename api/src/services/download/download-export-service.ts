import { DEFAULT_MAX_PART_SIZE_BYTES, EXPORTER_VERSION, SIGNED_URL_EXPIRY_DOWNLOAD } from '../../constants/download';
import { IDBConnection } from '../../database/db';
import { HTTP403, HTTP409 } from '../../errors/http-error';
import { DownloadStatusEnum } from '../../models/download-status';
import {
  CreateDownloadVersionExportRequest,
  DownloadVersionExportListRow,
  DownloadVersionExportRecord,
  DownloadVersionExportRow
} from '../../models/download-version-export';
import { DownloadVersionExportArtifactGroupRecord } from '../../models/download-version-export-artifact-group';
import { publishProcessDownloadVersionExportJob } from '../../queue/publisher';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DBService } from '../db-service';
import { BucketType, ObjectStorageService } from '../object-storage/object-storage-service';
import { DownloadService } from './download-service';

/**
 * Shape of a single entry in the detail endpoint's `parts[]` response.
 *
 * `byte_size` is renamed to `file_size_bytes` here to match the response shape
 * the frontend already consumes.
 */
export interface DownloadExportPart {
  chunk_id: number | null;
  file_size_bytes: string;
  url: string;
}

/**
 * Request-time service for download version exports.
 *
 * Owns the operations called by path handlers: resolve-or-create the shared artifact group +
 * create the per-user export, list, get, authorize, and presigned-URL assembly. Background
 * packaging work lives in the version-export pipeline service.
 *
 * @export
 * @class DownloadExportService
 * @extends {DBService}
 */
export class DownloadExportService extends DBService {
  downloadService: DownloadService;
  downloadVersionExportRepository: DownloadVersionExportRepository;

  /**
   * Mutable dependency bag used by tests to avoid stubbing module namespace exports under ESM.
   *
   * Wrapped in a thunk because `queue/publisher` imports `DownloadService` (which this service
   * composes) back, so a direct function reference here would be in TDZ when the module cycle
   * resolves through publisher first. Resolving at call time sidesteps the cycle.
   */
  static readonly dependencies = {
    publishProcessDownloadVersionExportJob: (
      ...args: Parameters<typeof publishProcessDownloadVersionExportJob>
    ): ReturnType<typeof publishProcessDownloadVersionExportJob> => publishProcessDownloadVersionExportJob(...args)
  };

  constructor(connection: IDBConnection) {
    super(connection);
    this.downloadService = new DownloadService(connection);
    this.downloadVersionExportRepository = new DownloadVersionExportRepository(connection);
  }

  /**
   * Create a CSV export for a ready download.
   *
   * Many user export requests for the same shape resolve onto a single physical artifact set keyed
   * by (version, format, mode, max_part_size_bytes, exporter_version): a second identical request
   * attaches to an already-`ready` group with no pipeline re-run. Each request still gets its own
   * `download_version_export` row (per-user provenance), but lifecycle state lives on the shared
   * group.
   *
   * The publish rides the route's connection so the export-row create and the job enqueue commit
   * atomically — and it fires only when the resolver materialized genuinely new work
   * (`shouldEnqueue`); attaching to an in-flight or finished group never re-queues.
   *
   * `max_part_size_bytes` lives per-export so a single download can be re-exported at different part
   * sizes without re-running the Parquet pipeline. `format` is hard-coded to `'csv'` and `mode` to
   * `'per_feature_type'` here because this ticket ships the single-shape contract; a future
   * denormalized-mode addition opens `mode` at the request layer.
   *
   * Exports are authenticated-only (HTTP403 when `systemUserId` is null) and require team
   * membership on the parent download — delegates to `DownloadService.getAuthorizedDownload` so the
   * team-auth rule lives in exactly one place. Only `ready` downloads with a materialized version
   * can export; `pending` / `processing` / `failed` parents surface 409 and the client retries
   * after the parent finishes.
   */
  async createDownloadVersionExport(
    downloadId: string,
    systemUserId: number | null,
    request: CreateDownloadVersionExportRequest,
    connection: IDBConnection
  ): Promise<DownloadVersionExportRecord> {
    if (systemUserId === null) {
      throw new HTTP403('Access denied');
    }

    // Throws HTTP403 / HTTP404 as appropriate.
    const download = await this.downloadService.getAuthorizedDownload(downloadId, systemUserId);

    if (download.download_status !== DownloadStatusEnum.READY) {
      throw new HTTP409('Download is not ready — cannot export');
    }

    if (download.current_download_version_id === null) {
      throw new HTTP409('Download has no materialized version');
    }

    const downloadVersionId = download.current_download_version_id;

    // Single-shape contract — `as const` is required so the literals satisfy the
    // `z.literal('csv')` / `z.literal('per_feature_type')` payload fields (a bare const widens to
    // `string`).
    const format = 'csv' as const;
    const mode = 'per_feature_type' as const;
    const maxPartSizeBytes = request.max_part_size_bytes ?? DEFAULT_MAX_PART_SIZE_BYTES;

    const { group, shouldEnqueue } = await this.resolveOrCreateActiveExportArtifactGroup(
      downloadVersionId,
      format,
      mode,
      maxPartSizeBytes,
      EXPORTER_VERSION
    );

    const exportRow = await this.downloadVersionExportRepository.createDownloadVersionExport({
      download_version_id: downloadVersionId,
      format,
      mode,
      max_part_size_bytes: maxPartSizeBytes,
      download_version_export_artifact_group_id: group.download_version_export_artifact_group_id
    });

    if (shouldEnqueue) {
      await DownloadExportService.dependencies.publishProcessDownloadVersionExportJob(connection, {
        downloadVersionExportArtifactGroupId: group.download_version_export_artifact_group_id
      });
    }

    return assembleExportRecord(exportRow, group, downloadId);
  }

  /**
   * Resolve the active artifact group for an export shape, materializing one when none is usable.
   *
   * - `ready` / `pending` / `processing` → reuse the existing group (no new job): the work is done
   *   or in flight, so a second identical request rides it.
   * - `failed` → end the dead group (its `error_message` is preserved as failure history) and
   *   create a fresh one; never reuse a failed group's id/key prefix, which risks contaminating the
   *   retry with the aborted run's zip parts.
   * - none → create.
   *
   * The create uses `ON CONFLICT DO NOTHING` + re-select so two racing identical requests converge
   * on one group; `shouldEnqueue` is true only for genuinely new work.
   */
  private async resolveOrCreateActiveExportArtifactGroup(
    downloadVersionId: string,
    format: string,
    mode: string,
    maxPartSizeBytes: string,
    exporterVersion: number
  ): Promise<{ group: DownloadVersionExportArtifactGroupRecord; shouldEnqueue: boolean }> {
    const existing = await this.downloadVersionExportRepository.findActiveExportArtifactGroup(
      downloadVersionId,
      format,
      mode,
      maxPartSizeBytes,
      exporterVersion
    );

    if (existing) {
      if (existing.status === DownloadStatusEnum.FAILED) {
        await this.downloadVersionExportRepository.endExportArtifactGroup(
          existing.download_version_export_artifact_group_id
        );
        // Fall through to create a fresh group.
      } else {
        return { group: existing, shouldEnqueue: false };
      }
    }

    await this.downloadVersionExportRepository.createExportArtifactGroup({
      downloadVersionId,
      format,
      mode,
      maxPartSizeBytes,
      exporterVersion
    });

    const group = await this.downloadVersionExportRepository.findActiveExportArtifactGroup(
      downloadVersionId,
      format,
      mode,
      maxPartSizeBytes,
      exporterVersion
    );

    // The partial-unique insert serializes at the DB, so this immediate re-select always finds
    // exactly one active row (race-safe) — the `!` is intentional, never null here.
    return { group: group!, shouldEnqueue: true };
  }

  /**
   * List exports for a download, newest first, with `part_count` per row.
   */
  async listDownloadVersionExportsByDownloadId(downloadId: string): Promise<DownloadVersionExportListRow[]> {
    return this.downloadVersionExportRepository.listDownloadVersionExportsByDownloadId(downloadId);
  }

  /**
   * Get an export by ID, throwing if not found.
   */
  async getDownloadVersionExportById(exportId: string): Promise<DownloadVersionExportRecord> {
    return this.downloadVersionExportRepository.getDownloadVersionExportById(exportId);
  }

  /**
   * Authorize a user for an export under a specific parent download.
   *
   * Authorizes against the parent download (the team-membership rule lives in exactly one place —
   * `DownloadService.getAuthorizedDownload`), then loads the export and confirms it belongs to that
   * download. Exports are authenticated-only — the Parquet download is the unauthenticated path and
   * anonymous UUID holders must `PUT /api/download/:id` to claim before they can export.
   */
  async getAuthorizedExport(
    downloadId: string,
    exportId: string,
    systemUserId: number | null
  ): Promise<DownloadVersionExportRecord> {
    await this.downloadService.getAuthorizedDownload(downloadId, systemUserId);

    const exportRecord = await this.downloadVersionExportRepository.getDownloadVersionExportById(exportId);

    if (exportRecord.download_id !== downloadId) {
      throw new HTTP403('Access denied');
    }

    return exportRecord;
  }

  /**
   * Build the `parts[]` array for the detail endpoint response.
   *
   * One presigned URL per part-zip, signed at request time. The
   * `byte_size → file_size_bytes` rename matches the response shape the
   * frontend already consumes.
   *
   * The presigned URL carries a `Content-Disposition` override so the browser
   * saves each zip as `{YYYYMMDD-HHMMSS}-biohub-{exportId}-part-{N}.zip`. The
   * timestamp is derived from `started_at` (not the S3 key) so zips from
   * multiple exports under the same download sort chronologically in the
   * user's Downloads folder — UUID-only filenames sort alphabetically by
   * random hex, which is meaningless to a human scanning a file list.
   */
  async listExportPartUrls(exportId: string, startedAt: string | null): Promise<DownloadExportPart[]> {
    const artifacts = await this.downloadVersionExportRepository.listExportArtifactGroupArtifactsByExportId(exportId);
    const objectStorageService = new ObjectStorageService();
    const timestampPrefix = formatDownloadTimestampPrefix(startedAt);

    return Promise.all(
      artifacts.map(async (artifact) => {
        const downloadFileName = `${timestampPrefix}-biohub-${exportId}-part-${artifact.chunk_id}.zip`;
        return {
          chunk_id: artifact.chunk_id,
          file_size_bytes: artifact.byte_size,
          url: await objectStorageService.getSignedUrl(
            BucketType.MAIN,
            artifact.object_key,
            SIGNED_URL_EXPIRY_DOWNLOAD,
            `attachment; filename="${downloadFileName}"`
          )
        };
      })
    );
  }
}

/**
 * Compose the full export record for the create path from the inserted row, the in-hand artifact
 * group, and the parent download id.
 *
 * Pure — no I/O. Lifecycle status/timing/error live on the group, never the per-user export, and
 * `download_id` is the parent already resolved by the caller — so the create path needs no
 * JOIN-on-RETURNING to build the same shape `findDownloadVersionExportById` returns.
 *
 * Fields are picked explicitly rather than spread from `exportRow`: the thin row carries the
 * internal `download_version_id` and artifact-group FKs, which are not part of the client contract —
 * a spread would re-introduce them onto the response object past the narrowed return type.
 */
function assembleExportRecord(
  exportRow: DownloadVersionExportRow,
  group: DownloadVersionExportArtifactGroupRecord,
  downloadId: string
): DownloadVersionExportRecord {
  return {
    download_version_export_id: exportRow.download_version_export_id,
    format: exportRow.format,
    mode: exportRow.mode,
    max_part_size_bytes: exportRow.max_part_size_bytes,
    download_id: downloadId,
    status: group.status,
    started_at: group.started_at,
    completed_at: group.completed_at,
    error_message: group.error_message
  };
}

/**
 * Format an ISO timestamp as `YYYYMMDD-HHMMSS` in UTC so filenames sort
 * lexicographically = chronologically regardless of the user's locale. Falls
 * back to "now" if `started_at` is null (a READY export always has it set,
 * but the column is nullable and a defensive default beats a `null-null-null`
 * prefix in the rare pathological case).
 */
function formatDownloadTimestampPrefix(isoTimestamp: string | null): string {
  const date = isoTimestamp ? new Date(isoTimestamp) : new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    '-' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

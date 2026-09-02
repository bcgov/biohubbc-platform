import { DEFAULT_MAX_PART_SIZE_BYTES, EXPORTER_VERSION, SIGNED_URL_EXPIRY_DOWNLOAD } from '../../constants/download';
import { IDBConnection } from '../../database/db';
import { HTTP403, HTTP404, HTTP409 } from '../../errors/http-error';
import { ExportConfig } from '../../models/download-export-config';
import { DownloadStatusEnum } from '../../models/download-status';
import {
  CreateDownloadVersionExportRequest,
  DownloadExportFeatureType,
  DownloadVersionExportListRow,
  DownloadVersionExportRecord,
  DownloadVersionExportRow
} from '../../models/download-version-export';
import { DownloadVersionExportArtifactGroupRecord } from '../../models/download-version-export-artifact-group';
import { publishProcessDownloadVersionExportJob } from '../../queue/publisher';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadVersionRepository } from '../../repositories/download/download-version-repository';
import {
  canonicalizeExportConfig,
  computeConfigHash,
  materializedColumnsForType,
  validateExportConfig
} from '../../utils/export-config-utils';
import { parseExportPartKey, parseFeatureTypeFromParquetKey } from '../../utils/export-utils';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { CodeService } from '../code-service';
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
  chunk_id: number;
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
  codeService: CodeService;
  downloadVersionRepository: DownloadVersionRepository;

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
    this.codeService = new CodeService(connection);
    this.downloadVersionRepository = new DownloadVersionRepository(connection);
  }

  /**
   * Create a CSV export for a ready download from a caller-supplied export recipe.
   *
   * The recipe (an `ExportConfig`) is validated against the download's materialized data BEFORE any
   * artifact group or job is created: `validateExportConfig` throws `ApiValidationError` (HTTP400)
   * on any structural or existence problem, so an invalid recipe never materializes a group or
   * enqueues a job — the request fails clean with nothing persisted.
   *
   * Many user requests for the same recipe resolve onto a single physical artifact set keyed by the
   * canonical `config_hash` (with version, max_part_size_bytes, exporter_version): a second
   * logically-identical request attaches to an already-`ready` group with no pipeline re-run. Each
   * request still gets its own `download_version_export` row (per-user provenance), but lifecycle
   * state lives on the shared group.
   *
   * The publish rides the route's connection so the export-row create and the job enqueue commit
   * atomically — and it fires only when the resolver materialized genuinely new work
   * (`shouldEnqueue`); attaching to an in-flight or finished group never re-queues.
   *
   * `max_part_size_bytes` is packaging, not recipe: it controls how the bytes split into parts and
   * is peeled off before canonicalizing/hashing, so two requests that differ only in part size still
   * reuse the same artifact group rather than fragmenting it. `format` is the recipe's `'csv'`
   * literal; `mode` is whatever the validated recipe resolved to (`per_feature_type` or
   * `denormalized`).
   *
   * Exports are authenticated-only (HTTP403 when `systemUserId` is null) and require team
   * membership on the parent download — delegates to `DownloadService.getAuthorizedDownload` so the
   * team-auth rule lives in exactly one place. The caller names an explicit `download_version_id` in
   * the request: the service verifies that version belongs to the authorized download (HTTP404
   * otherwise, so a caller authorized on one download cannot reach another download's artifacts by
   * naming its version id) and requires the version itself to be `ready` (HTTP409 otherwise, with the
   * client retrying after materialization finishes). Readiness is gated on the named version's own
   * status — which may legitimately be older than the download's most-recent version — not the
   * parent download's.
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

    // Authorize the caller against the parent download named in the URL. The team-membership rule
    // lives in exactly one place (DownloadService.getAuthorizedDownload). Throws HTTP403 / HTTP404.
    await this.downloadService.getAuthorizedDownload(downloadId, systemUserId);

    // The version is the explicit export target. getDownloadVersionStatusById throws HTTP404 when it
    // does not exist; we then verify it belongs to the authorized download so a caller authorized on
    // one download cannot export another download's materialized artifacts by naming its version id.
    const version = await this.downloadVersionRepository.getDownloadVersionStatusById(request.download_version_id);

    if (version.download_id !== downloadId) {
      throw new HTTP404('Download version not found');
    }

    // An export is bound to one materialized snapshot — only a ready version can export. The named
    // version may legitimately be older than the download's most-recent version, so readiness is
    // gated on the version's own status, not the parent download's.
    if (version.status !== DownloadStatusEnum.READY) {
      throw new HTTP409('Download version is not ready — cannot export');
    }

    // Strip the packaging knob AND the version id off before validating/hashing — neither is part of
    // the content recipe. `max_part_size_bytes` is packaging; `download_version_id` is a separate
    // dimension of the artifact-group key. What's left (`rawConfig`) is the pure export recipe.
    const { download_version_id: downloadVersionId, max_part_size_bytes, ...rawConfig } = request;
    const config = ExportConfig.parse(rawConfig);
    const maxPartSizeBytes = max_part_size_bytes ?? DEFAULT_MAX_PART_SIZE_BYTES;

    // Throws ApiValidationError (HTTP400) on any structural or existence problem — runs before any
    // group/job is created so an invalid recipe never persists.
    const availableColumnsByType = await this.buildAvailableColumnsByType(downloadId, downloadVersionId);
    validateExportConfig(config, availableColumnsByType);

    const normalized = canonicalizeExportConfig(config);
    const configHash = computeConfigHash(normalized);

    const { group, shouldEnqueue } = await this.resolveOrCreateActiveExportArtifactGroup(
      downloadVersionId,
      normalized,
      configHash,
      maxPartSizeBytes,
      EXPORTER_VERSION
    );

    const exportRow = await this.downloadVersionExportRepository.createDownloadVersionExport({
      download_version_id: downloadVersionId,
      format: 'csv',
      mode: normalized.mode,
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
   * Resolve the active artifact group for an export recipe, materializing one when none is usable.
   *
   * Groups are keyed on the canonical `configHash` (with version, max_part_size_bytes,
   * exporter_version) so logically-identical recipes against one version collapse onto a single
   * artifact group and reuse its already-built (or in-flight) parts:
   * - `ready` / `pending` / `processing` → reuse the existing group (no new job): the work is done
   *   or in flight, so a second identical request rides it.
   * - `failed` → end the dead group (its `error_message` is preserved as failure history) and
   *   create a fresh one; never reuse a failed group's id/key prefix, which risks contaminating the
   *   retry with the aborted run's zip parts.
   * - none → create.
   *
   * The create uses `ON CONFLICT DO NOTHING` + re-select so two racing identical requests converge
   * on one group; `shouldEnqueue` is true only when THIS call created the group — a reused group's
   * artifacts already exist or are being built, so re-queuing would be wasted work.
   */
  private async resolveOrCreateActiveExportArtifactGroup(
    downloadVersionId: string,
    normalizedConfig: ExportConfig,
    configHash: string,
    maxPartSizeBytes: string,
    exporterVersion: number
  ): Promise<{ group: DownloadVersionExportArtifactGroupRecord; shouldEnqueue: boolean }> {
    const existing = await this.downloadVersionExportRepository.findActiveExportArtifactGroup(
      downloadVersionId,
      configHash,
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

    const inserted = await this.downloadVersionExportRepository.createExportArtifactGroup({
      downloadVersionId,
      config: normalizedConfig,
      configHash,
      format: normalizedConfig.export_type,
      mode: normalizedConfig.mode,
      maxPartSizeBytes,
      exporterVersion
    });

    const group = await this.downloadVersionExportRepository.findActiveExportArtifactGroup(
      downloadVersionId,
      configHash,
      maxPartSizeBytes,
      exporterVersion
    );

    // The partial-unique insert serializes at the DB, so this immediate re-select always finds
    // exactly one active row (race-safe) — the `!` is intentional, never null here.
    //
    // Enqueue only when THIS call actually inserted the group. If a concurrent identical request
    // won the `ON CONFLICT` race, `inserted` is false and we re-select onto its group — it already
    // enqueued the one job, so re-queuing here would run the same build twice over the same S3 keys.
    return { group: group!, shouldEnqueue: inserted };
  }

  /**
   * Build the exportable column set for every feature type materialized for this download's version.
   *
   * The column set per type MUST mirror exactly what the export pipeline materializes — structural
   * columns (`submission_feature_id` / `uuid` / `parent_uuid`) followed by the schema-derived
   * headers, via `materializedColumnsForType`. Backs both AC8 recipe validation and the picker read,
   * so a divergence here would either reject valid recipes or offer columns the CSV can't produce.
   *
   * Only types that actually produced a Parquet file for this version are included; the schema
   * codes are filtered down to that materialized set so the picker never offers a type with no data.
   */
  private async buildAvailableColumnsByType(downloadId: string, versionId: string): Promise<Map<string, Set<string>>> {
    const materialized = await this.listMaterializedFeatureTypes(downloadId, versionId);
    const codes = await this.codeService.getFeatureTypePropertyCodes();

    const availableColumnsByType = new Map<string, Set<string>>();
    for (const code of codes) {
      if (!materialized.has(code.feature_type.name)) {
        continue;
      }
      const properties = code.properties.map((p) => ({
        feature_property_name: p.name,
        feature_property_type_name: p.type_name
      }));
      availableColumnsByType.set(code.feature_type.name, new Set(materializedColumnsForType(properties)));
    }

    return availableColumnsByType;
  }

  /**
   * Resolve the set of feature types that actually materialized a Parquet file for this version.
   *
   * Reads the version's artifacts and maps each Parquet object key back to its feature type; keys
   * that are not per-type Parquet sources (e.g. export part-zips) parse to null and drop out.
   */
  private async listMaterializedFeatureTypes(downloadId: string, versionId: string): Promise<Set<string>> {
    const artifacts = await this.downloadVersionRepository.listDownloadVersionArtifactsByDownloadVersionId(versionId);

    return new Set(
      artifacts
        .map((artifact) => parseFeatureTypeFromParquetKey(artifact.object_key, downloadId, versionId))
        .filter((featureType): featureType is string => featureType !== null)
    );
  }

  /**
   * List exports for a download, newest first, with `part_count` per row.
   */
  async listDownloadVersionExports(
    downloadId: string,
    pagination?: ApiPaginationOptions
  ): Promise<DownloadVersionExportListRow[]> {
    return this.downloadVersionExportRepository.listDownloadVersionExports(downloadId, pagination);
  }

  /**
   * Count exports for a download.
   */
  async listDownloadVersionExportsCount(downloadId: string): Promise<number> {
    return this.downloadVersionExportRepository.listDownloadVersionExportsCount(downloadId);
  }

  /**
   * List the feature types (and their exportable columns) a download's most-recent version can export.
   *
   * Backs the export-recipe picker: the client builds a recipe by choosing among exactly these
   * types and columns. The column set per type mirrors precisely what the export pipeline
   * materializes (structural columns + schema headers via `materializedColumnsForType`), so the
   * picker can never offer a column the CSV won't produce — the same guarantee AC8 validation
   * enforces on the inbound recipe.
   *
   * The version is the download's most-recent (`download.download_version_id`, resolved by the read
   * query) — the same version the client sends back as `download_version_id` on the export request,
   * so the columns shown and the version exported are guaranteed to be the same materialized snapshot.
   *
   * Authorizes against the parent download (the team-membership rule lives in exactly one place —
   * `DownloadService.getAuthorizedDownload`); only `ready` downloads with a materialized version
   * have exportable data, so a `pending` / `processing` / `failed` parent surfaces 409.
   */
  async getDownloadVersionExportFeatureTypes(
    downloadId: string,
    systemUserId: number | null
  ): Promise<DownloadExportFeatureType[]> {
    // Throws HTTP403 / HTTP404 as appropriate.
    const download = await this.downloadService.getAuthorizedDownload(downloadId, systemUserId);

    if (download.download_status !== DownloadStatusEnum.READY) {
      throw new HTTP409('Download is not ready — cannot export');
    }

    const availableColumnsByType = await this.buildAvailableColumnsByType(downloadId, download.download_version_id);

    return [...availableColumnsByType].map(([feature_type, columns]) => ({
      feature_type,
      columns: [...columns]
    }));
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
   * saves each zip as `{downloadId}_{downloadVersionId}_{timestamp}_part{N}.zip`.
   * The download + version ids name the lineage (which download, which snapshot)
   * and are read from the same object key that locates the file, so the name
   * always describes its contents. The timestamp (the group's `started_at`) keeps
   * two distinct export runs of the same download+version — a re-export at a
   * different part size, or a failed-group recreate — from colliding; file
   * explorers handle chronological sort via the OS download date, so it is not
   * needed as a leading sort key.
   */
  async listExportPartUrls(exportId: string, startedAt: string | null): Promise<DownloadExportPart[]> {
    const artifacts = await this.downloadVersionExportRepository.listExportArtifactGroupArtifactsByExportId(exportId);
    const objectStorageService = new ObjectStorageService();
    const timestamp = formatDownloadTimestampPrefix(startedAt);

    return Promise.all(
      artifacts.map(async (artifact) => {
        const { downloadId, downloadVersionId } = parseExportPartKey(artifact.object_key);
        const downloadFileName = `${downloadId}_${downloadVersionId}_${timestamp}_part${artifact.chunk_id}.zip`;
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

  /**
   * Authorize a user for an export and, when it is `ready`, assemble its presigned part URLs.
   *
   * The detail endpoint's full shape in a single call: authorize against the parent download, load
   * the export, and populate `parts[]` only for a `ready` export — `pending` / `processing` /
   * `failed` return `[]` so clients don't attempt to download from URLs for an incomplete job. The
   * status gate lives here, not in the route handler, so it is unit-testable without driving the
   * HTTP layer.
   */
  async getAuthorizedExportWithParts(
    downloadId: string,
    exportId: string,
    systemUserId: number | null
  ): Promise<DownloadVersionExportRecord & { parts: DownloadExportPart[] }> {
    const exportRecord = await this.getAuthorizedExport(downloadId, exportId, systemUserId);

    const parts =
      exportRecord.status === DownloadStatusEnum.READY
        ? await this.listExportPartUrls(exportId, exportRecord.started_at)
        : [];

    return { ...exportRecord, parts };
  }
}

/**
 * Compose the full export record for the create path from the inserted row, the in-hand artifact
 * group, and the parent download id.
 *
 * Pure — no I/O. Lifecycle status/timing/error live on the group, never the per-user export, and
 * `download_id` is the parent already resolved by the caller — so the create path needs no
 * JOIN-on-RETURNING to build the same shape `getDownloadVersionExportById` returns.
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

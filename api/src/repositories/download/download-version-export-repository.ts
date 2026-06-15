import SQL from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { ExportConfig } from '../../models/download-export-config';
import { DownloadStatusEnum } from '../../models/download-status';
import {
  CreateDownloadVersionExportPayload,
  DownloadVersionExportListRow,
  DownloadVersionExportRecord,
  DownloadVersionExportRow
} from '../../models/download-version-export';
import { DownloadVersionExportArtifactWithFile } from '../../models/download-version-export-artifact';
import { DownloadVersionExportArtifactGroupRecord } from '../../models/download-version-export-artifact-group';
import { BaseRepository } from '../base-repository';

/**
 * Service-layer payload for materializing (or finding) the active artifact group.
 *
 * The dedupe key is (version, config_hash, max_part_size_bytes, exporter_version) —
 * exactly one active group exists per shape, and `configHash` stands in for the full
 * recipe. `config` is persisted alongside the hash so the job can re-read the recipe;
 * `format`/`mode` are denormalized from the config for cheap admin/diagnostic filters.
 * `status` is deliberately absent: the DB DEFAULT ('pending') owns the initial
 * lifecycle state.
 */
export interface CreateExportArtifactGroupPayload {
  downloadVersionId: string;
  config: ExportConfig;
  configHash: string;
  format: string;
  mode: string;
  maxPartSizeBytes: string;
  exporterVersion: number;
}

/**
 * A repository class for accessing download version export data.
 *
 * A `download_version_export` is a per-user request for an export shape against a
 * version; it carries no lifecycle state. The shared, materialized output lives on
 * the `download_version_export_artifact_group` it attaches to — identical requests
 * dedupe onto the active group rather than rebuilding it, so a second request for
 * the same shape attaches to an already-`ready` group with no pipeline re-run.
 *
 * @export
 * @class DownloadVersionExportRepository
 * @extends {BaseRepository}
 */
export class DownloadVersionExportRepository extends BaseRepository {
  /**
   * Probe for the active artifact group matching an export shape.
   *
   * Single-row read on the partial-unique key (version, config_hash,
   * max_part_size_bytes, exporter_version). `config_hash` stands in for the full
   * recipe — identical recipes hash equal and dedupe onto the same group. Returns
   * null when no active group exists yet — the caller then materializes one.
   *
   * @return {Promise<DownloadVersionExportArtifactGroupRecord | null>}
   * @memberof DownloadVersionExportRepository
   */
  async findActiveExportArtifactGroup(
    downloadVersionId: string,
    configHash: string,
    maxPartSizeBytes: string,
    exporterVersion: number
  ): Promise<DownloadVersionExportArtifactGroupRecord | null> {
    const sql = SQL`
      SELECT
        download_version_export_artifact_group_id,
        download_version_id,
        config,
        config_hash,
        format,
        mode,
        max_part_size_bytes,
        exporter_version,
        status,
        started_at,
        completed_at,
        error_message
      FROM download_version_export_artifact_group
      WHERE download_version_id = ${downloadVersionId}
        AND config_hash = ${configHash}
        AND max_part_size_bytes = ${maxPartSizeBytes}
        AND exporter_version = ${exporterVersion}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportArtifactGroupRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Materialize the active artifact group for an export shape.
   *
   * The partial-unique index plus `ON CONFLICT … WHERE record_end_date IS NULL
   * DO NOTHING` lets exactly one of two racing identical requests insert the
   * group; the loser gets rowCount 0 (a valid outcome — NO throw) and re-selects
   * the winner's row. `status` is omitted so the DB DEFAULT ('pending') applies.
   *
   * Returns whether THIS call inserted the group: `true` when the row was created,
   * `false` when it lost the `ON CONFLICT` race to a concurrent identical request.
   * The caller relies on this to enqueue the pipeline job exactly once — the loser
   * attaches to the winner's (already-enqueued) group instead of double-queuing.
   *
   * `format` and `mode` are denormalized from the hashed config for cheap
   * admin/diagnostic filters; they are written only from the parsed config —
   * never independently — because `config_hash` already encodes them.
   *
   * @param {CreateExportArtifactGroupPayload} payload
   * @return {Promise<boolean>} `true` if this call inserted the group, `false` on conflict.
   * @memberof DownloadVersionExportRepository
   */
  async createExportArtifactGroup(payload: CreateExportArtifactGroupPayload): Promise<boolean> {
    const sql = SQL`
      INSERT INTO download_version_export_artifact_group (download_version_id, format, mode, max_part_size_bytes, exporter_version, config, config_hash)
      VALUES (
        ${payload.downloadVersionId},
        ${payload.config.export_type},
        ${payload.config.mode},
        ${payload.maxPartSizeBytes},
        ${payload.exporterVersion},
        ${JSON.stringify(payload.config)}::jsonb,
        ${payload.configHash}
      )
      ON CONFLICT (download_version_id, config_hash, max_part_size_bytes, exporter_version) WHERE record_end_date IS NULL DO NOTHING;
    `;

    const response = await this.connection.sql(sql);

    // `ON CONFLICT DO NOTHING` reports rowCount 1 when this INSERT created the row
    // and 0 when a concurrent identical request already did — the loser's signal to
    // skip enqueuing a duplicate job.
    return response.rowCount === 1;
  }

  /**
   * Soft-end an artifact group, preserving its error history.
   *
   * A failed group is ended (its `error_message` left intact as a record of the
   * failure) and a fresh group created in its place; retrying the failed group's
   * id directly risks contaminating the retry with its aborted zip parts.
   *
   * @param {string} downloadVersionExportArtifactGroupId - The group ID to end.
   * @return {Promise<void>}
   * @memberof DownloadVersionExportRepository
   */
  async endExportArtifactGroup(downloadVersionExportArtifactGroupId: string): Promise<void> {
    const sql = SQL`
      UPDATE download_version_export_artifact_group
      SET record_end_date = now()
      WHERE download_version_export_artifact_group_id = ${downloadVersionExportArtifactGroupId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to end export artifact group', [
        'DownloadVersionExportRepository->endExportArtifactGroup',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Update artifact-group status with optional timestamp + error-message bookkeeping.
   *
   * COALESCE keeps previous values when the caller omits a field — the service
   * decides which timestamps to send; the repo just applies them. Lifecycle
   * state lives on the group, never the per-user export.
   *
   * @param {string} downloadVersionExportArtifactGroupId - The group ID.
   * @param {DownloadStatusEnum} status - The new status.
   * @param {object} [metadata] - Optional timestamp / error bookkeeping.
   * @return {Promise<void>}
   * @memberof DownloadVersionExportRepository
   */
  async updateExportArtifactGroupStatus(
    downloadVersionExportArtifactGroupId: string,
    status: DownloadStatusEnum,
    metadata?: {
      started_at?: string;
      completed_at?: string;
      error_message?: string;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download_version_export_artifact_group
      SET
        status = ${status},
        started_at = COALESCE(${metadata?.started_at ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${metadata?.completed_at ?? null}::timestamptz, completed_at),
        error_message = COALESCE(${metadata?.error_message ?? null}, error_message)
      WHERE download_version_export_artifact_group_id = ${downloadVersionExportArtifactGroupId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update export artifact group status', [
        'DownloadVersionExportRepository->updateExportArtifactGroupStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get an artifact group by ID.
   *
   * `find*` returns null on missing (codebase convention — companion to
   * `getExportArtifactGroupById`).
   *
   * @param {string} downloadVersionExportArtifactGroupId - The group ID.
   * @return {Promise<DownloadVersionExportArtifactGroupRecord | null>}
   * @memberof DownloadVersionExportRepository
   */
  async findExportArtifactGroupById(
    downloadVersionExportArtifactGroupId: string
  ): Promise<DownloadVersionExportArtifactGroupRecord | null> {
    const sql = SQL`
      SELECT
        download_version_export_artifact_group_id,
        download_version_id,
        config,
        config_hash,
        format,
        mode,
        max_part_size_bytes,
        exporter_version,
        status,
        started_at,
        completed_at,
        error_message
      FROM download_version_export_artifact_group
      WHERE download_version_export_artifact_group_id = ${downloadVersionExportArtifactGroupId};
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportArtifactGroupRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get an artifact group by ID, throwing if not found.
   *
   * @param {string} downloadVersionExportArtifactGroupId - The group ID.
   * @return {Promise<DownloadVersionExportArtifactGroupRecord>}
   * @throws {ApiNotFoundError} when no group matches the given ID.
   * @memberof DownloadVersionExportRepository
   */
  async getExportArtifactGroupById(
    downloadVersionExportArtifactGroupId: string
  ): Promise<DownloadVersionExportArtifactGroupRecord> {
    const record = await this.findExportArtifactGroupById(downloadVersionExportArtifactGroupId);

    if (!record) {
      throw new ApiNotFoundError('Export artifact group not found', [
        'DownloadVersionExportRepository->getExportArtifactGroupById',
        `no download_version_export_artifact_group with id ${downloadVersionExportArtifactGroupId}`
      ]);
    }

    return record;
  }

  /**
   * Create a per-user export request attached to an artifact group.
   *
   * Returns the thin row (the table's own columns only). Lifecycle state
   * (status/timing/error) is NOT on this table — it lives on the group — so the
   * RETURNING list is the six table columns and nothing more.
   *
   * @param {CreateDownloadVersionExportPayload} payload
   * @return {Promise<DownloadVersionExportRow>}
   * @memberof DownloadVersionExportRepository
   */
  async createDownloadVersionExport(payload: CreateDownloadVersionExportPayload): Promise<DownloadVersionExportRow> {
    const sql = SQL`
      INSERT INTO download_version_export (download_version_id, download_version_export_artifact_group_id, format, mode, max_part_size_bytes)
      VALUES (
        ${payload.download_version_id},
        ${payload.download_version_export_artifact_group_id},
        ${payload.format},
        ${payload.mode},
        ${payload.max_part_size_bytes}
      )
      RETURNING
        download_version_export_id,
        download_version_id,
        download_version_export_artifact_group_id,
        format,
        mode,
        max_part_size_bytes;
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportRow);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download version export record', [
        'DownloadVersionExportRepository->createDownloadVersionExport',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Link a part-zip artifact to an artifact group with `chunk_id` as the 1-based
   * part index.
   *
   * Idempotent — the export pipeline may retry a whole part after a transient
   * failure; a retried insert for the same (group, artifact) is a silent no-op.
   * The `ON CONFLICT … WHERE record_end_date IS NULL DO NOTHING` clause matches
   * the partial unique index, so rowCount 0 on conflict is a valid outcome and
   * does NOT throw.
   *
   * @param {string} downloadVersionExportArtifactGroupId - The group ID.
   * @param {string} artifactId - The artifact ID.
   * @param {number} chunkId - The 1-based part index.
   * @return {Promise<void>}
   * @memberof DownloadVersionExportRepository
   */
  async createExportArtifactGroupArtifact(
    downloadVersionExportArtifactGroupId: string,
    artifactId: string,
    chunkId: number
  ): Promise<void> {
    const sql = SQL`
      INSERT INTO download_version_export_artifact (download_version_export_artifact_group_id, artifact_id, chunk_id)
      VALUES (${downloadVersionExportArtifactGroupId}, ${artifactId}, ${chunkId})
      ON CONFLICT (download_version_export_artifact_group_id, artifact_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * Get a full export record by ID.
   *
   * JOINs export → version (for `download_id`) and export → group (for the
   * group-owned lifecycle fields status/started_at/completed_at/error_message).
   * The group is always set by the service before insert, so an INNER JOIN is
   * correct — there is no export without a group.
   *
   * `find*` returns null on missing (companion to `getDownloadVersionExportById`).
   *
   * @param {string} downloadVersionExportId - The export ID.
   * @return {Promise<DownloadVersionExportRecord | null>}
   * @memberof DownloadVersionExportRepository
   */
  async findDownloadVersionExportById(downloadVersionExportId: string): Promise<DownloadVersionExportRecord | null> {
    const sql = SQL`
      SELECT
        de.download_version_export_id,
        de.format,
        de.mode,
        de.max_part_size_bytes,
        dv.download_id,
        g.status,
        g.started_at,
        g.completed_at,
        g.error_message
      FROM download_version_export de
      INNER JOIN download_version dv ON dv.download_version_id = de.download_version_id
      INNER JOIN download_version_export_artifact_group g
        ON g.download_version_export_artifact_group_id = de.download_version_export_artifact_group_id
      WHERE de.download_version_export_id = ${downloadVersionExportId};
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get a full export record by ID, throwing if not found.
   *
   * @param {string} downloadVersionExportId - The export ID.
   * @return {Promise<DownloadVersionExportRecord>}
   * @throws {ApiNotFoundError} when no export matches the given ID.
   * @memberof DownloadVersionExportRepository
   */
  async getDownloadVersionExportById(downloadVersionExportId: string): Promise<DownloadVersionExportRecord> {
    const record = await this.findDownloadVersionExportById(downloadVersionExportId);

    if (!record) {
      throw new ApiNotFoundError('Download version export not found', [
        'DownloadVersionExportRepository->getDownloadVersionExportById',
        `no download_version_export with id ${downloadVersionExportId}`
      ]);
    }

    return record;
  }

  /**
   * List all exports for a download, newest first, with group lifecycle fields
   * and `part_count` so the card can render single-vs-multi-part UI without a
   * detail-endpoint round-trip.
   *
   * Walks export → version → download to resolve `download_id`, joins the group
   * for status/timing/error, and LEFT JOINs the group's artifacts so pending
   * groups with no parts yet resolve `part_count` to 0.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadVersionExportListRow[]>}
   * @memberof DownloadVersionExportRepository
   */
  async listDownloadVersionExportsByDownloadId(downloadId: string): Promise<DownloadVersionExportListRow[]> {
    const sql = SQL`
      SELECT
        de.download_version_export_id,
        de.format,
        de.mode,
        de.max_part_size_bytes,
        dv.download_id,
        g.status,
        g.started_at,
        g.completed_at,
        g.error_message,
        COALESCE(COUNT(dvea.download_version_export_artifact_id), 0)::integer AS part_count
      FROM download_version_export de
      INNER JOIN download_version dv ON dv.download_version_id = de.download_version_id
      INNER JOIN download_version_export_artifact_group g
        ON g.download_version_export_artifact_group_id = de.download_version_export_artifact_group_id
      LEFT JOIN download_version_export_artifact dvea
        ON dvea.download_version_export_artifact_group_id = g.download_version_export_artifact_group_id
       AND dvea.record_end_date IS NULL
      WHERE dv.download_id = ${downloadId}
      GROUP BY
        de.download_version_export_id,
        de.format,
        de.mode,
        de.max_part_size_bytes,
        dv.download_id,
        g.status,
        g.started_at,
        g.completed_at,
        g.error_message,
        de.create_date
      ORDER BY de.create_date DESC;
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportListRow);
    return response.rows;
  }

  /**
   * Batch variant of `listDownloadVersionExportsByDownloadId` keyed by an array
   * of download ids — serves an entire page of downloads in one query, avoiding
   * N+1.
   *
   * Ordered by `download_id` then `create_date DESC` so the caller can split the
   * flat rows into per-download slices while preserving reverse-chronological
   * order. The empty-array short-circuit avoids a `= ANY('{}')` no-op round-trip.
   *
   * @param {string[]} downloadIds - The download IDs.
   * @return {Promise<DownloadVersionExportListRow[]>}
   * @memberof DownloadVersionExportRepository
   */
  async listDownloadVersionExportsByDownloadIds(downloadIds: string[]): Promise<DownloadVersionExportListRow[]> {
    if (downloadIds.length === 0) {
      return [];
    }

    const sql = SQL`
      SELECT
        de.download_version_export_id,
        de.format,
        de.mode,
        de.max_part_size_bytes,
        dv.download_id,
        g.status,
        g.started_at,
        g.completed_at,
        g.error_message,
        COALESCE(COUNT(dvea.download_version_export_artifact_id), 0)::integer AS part_count
      FROM download_version_export de
      INNER JOIN download_version dv ON dv.download_version_id = de.download_version_id
      INNER JOIN download_version_export_artifact_group g
        ON g.download_version_export_artifact_group_id = de.download_version_export_artifact_group_id
      LEFT JOIN download_version_export_artifact dvea
        ON dvea.download_version_export_artifact_group_id = g.download_version_export_artifact_group_id
       AND dvea.record_end_date IS NULL
      WHERE dv.download_id = ANY(${downloadIds})
      GROUP BY
        de.download_version_export_id,
        de.format,
        de.mode,
        de.max_part_size_bytes,
        dv.download_id,
        g.status,
        g.started_at,
        g.completed_at,
        g.error_message,
        de.create_date
      ORDER BY dv.download_id ASC, de.create_date DESC;
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportListRow);
    return response.rows;
  }

  /**
   * List an export's part-zip artifacts with their file metadata.
   *
   * Reaches the parts through export → group → artifact join rows, then JOINs
   * `artifact` to surface `byte_size` + `object_key` so the service can build the
   * detail endpoint's `parts[]` shape in one round-trip. Filters
   * `a.byte_size IS NOT NULL` so pending/unuploaded artifacts never leak through —
   * the service-facing type is thus strictly non-null. Ordered by `chunk_id` ASC.
   *
   * @param {string} downloadVersionExportId - The export ID.
   * @return {Promise<DownloadVersionExportArtifactWithFile[]>}
   * @memberof DownloadVersionExportRepository
   */
  async listExportArtifactGroupArtifactsByExportId(
    downloadVersionExportId: string
  ): Promise<DownloadVersionExportArtifactWithFile[]> {
    const sql = SQL`
      SELECT
        dvea.download_version_export_artifact_id,
        dvea.download_version_export_artifact_group_id,
        dvea.artifact_id,
        dvea.chunk_id,
        a.byte_size,
        a.object_key
      FROM download_version_export de
      INNER JOIN download_version_export_artifact_group g
        ON g.download_version_export_artifact_group_id = de.download_version_export_artifact_group_id
      INNER JOIN download_version_export_artifact dvea
        ON dvea.download_version_export_artifact_group_id = g.download_version_export_artifact_group_id
       AND dvea.record_end_date IS NULL
      INNER JOIN artifact a ON a.artifact_id = dvea.artifact_id
      WHERE de.download_version_export_id = ${downloadVersionExportId}
        AND a.byte_size IS NOT NULL
      ORDER BY dvea.chunk_id ASC;
    `;

    const response = await this.connection.sql(sql, DownloadVersionExportArtifactWithFile);
    return response.rows;
  }
}

import SQL from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DownloadArtifactInfo } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionRecord, DownloadVersionStatusRecord } from '../../models/download-version';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing download version data.
 *
 * A download_version is the temporal axis of a download: re-running the same
 * invariant policy at a later point creates a new version that re-snapshots the
 * download to pick up newly uploaded features. The policy itself is never
 * recorded per version — only the materialized artifacts are.
 *
 * @export
 * @class DownloadVersionRepository
 * @extends {BaseRepository}
 */
export class DownloadVersionRepository extends BaseRepository {
  /**
   * Create a new download version row.
   *
   * Returns the thin record (with the generated `download_version_id`) so the caller can enqueue
   * the version's materialization job without a follow-up SELECT.
   *
   * @param {string} downloadId - The parent download ID.
   * @return {Promise<DownloadVersionRecord>}
   * @memberof DownloadVersionRepository
   */
  async createDownloadVersion(downloadId: string): Promise<DownloadVersionRecord> {
    const sql = SQL`
      INSERT INTO download_version (download_id)
      VALUES (${downloadId})
      RETURNING
        download_version_id,
        download_id;
    `;

    const response = await this.connection.sql(sql, DownloadVersionRecord);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download version record', [
        'DownloadVersionRepository->createDownloadVersion',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update a download version's materialization lifecycle (status + timing + error).
   *
   * The materialization status lives on the version, not the download — a download
   * can hold many versions, one materializing while an earlier one stays ready.
   * COALESCE preserves an already-set field when a later transition passes only the
   * fields it owns (e.g. the READY transition sets completed_at + materialized_at
   * without clearing the started_at written at PROCESSING; an error_message set on
   * FAILED — or a feature_count set on READY — is never cleared by a subsequent
   * update).
   *
   * @param {string} downloadVersionId - The download version ID.
   * @param {DownloadStatusEnum} status - The new lifecycle status.
   * @param {{ started_at?: string; completed_at?: string; materialized_at?: string; error_message?: string; feature_count?: number }} [metadata]
   *   Optional timestamps / error / materialized feature count to set alongside the status.
   * @return {Promise<void>}
   * @throws {ApiExecuteSQLError} when no version matches the given ID (rowCount !== 1).
   * @memberof DownloadVersionRepository
   */
  async updateDownloadVersionStatus(
    downloadVersionId: string,
    status: DownloadStatusEnum,
    metadata?: {
      started_at?: string;
      completed_at?: string;
      materialized_at?: string;
      error_message?: string;
      feature_count?: number;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download_version
      SET
        status = ${status},
        started_at = COALESCE(${metadata?.started_at ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${metadata?.completed_at ?? null}::timestamptz, completed_at),
        materialized_at = COALESCE(${metadata?.materialized_at ?? null}::timestamptz, materialized_at),
        error_message = COALESCE(${metadata?.error_message ?? null}, error_message),
        feature_count = COALESCE(${metadata?.feature_count ?? null}, feature_count)
      WHERE download_version_id = ${downloadVersionId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download version status', [
        'DownloadVersionRepository->updateDownloadVersionStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Link a raw artifact to a download version.
   *
   * Idempotent — the Parquet pipeline writes one link per feature-type Parquet
   * file, and re-running the pipeline for the same version must not duplicate
   * active rows. The `ON CONFLICT … WHERE record_end_date IS NULL DO NOTHING`
   * clause matches the table's partial unique index so a re-insert on a still-
   * active link is a silent no-op (rowCount 0 is a valid outcome, no throw).
   *
   * @param {string} downloadVersionId - The download version ID.
   * @param {string} artifactId - The artifact ID.
   * @param {(string | null)} featureTypeName - The feature type this artifact belongs to, or null.
   * @return {Promise<void>}
   * @memberof DownloadVersionRepository
   */
  async createDownloadVersionArtifact(
    downloadVersionId: string,
    artifactId: string,
    featureTypeName: string | null
  ): Promise<void> {
    const sql = SQL`
      INSERT INTO download_version_artifact (download_version_id, artifact_id, feature_type_name)
      VALUES (${downloadVersionId}, ${artifactId}, ${featureTypeName})
      ON CONFLICT (download_version_id, artifact_id) WHERE record_end_date IS NULL DO NOTHING;
    `;

    await this.connection.sql(sql);
  }

  /**
   * List the active raw artifacts for a download version, joined to `artifact`
   * for the S3 `object_key`.
   *
   * Used by the export pipeline to discover which Parquet files the version
   * produced without re-running the original search. Bounded by feature-type
   * count for the version (tens at worst), so no pagination needed.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<DownloadArtifactInfo[]>}
   * @memberof DownloadVersionRepository
   */
  async listDownloadVersionArtifactsByDownloadVersionId(downloadVersionId: string): Promise<DownloadArtifactInfo[]> {
    const sql = SQL`
      SELECT
        a.artifact_id,
        a.object_key
      FROM download_version_artifact dva
      INNER JOIN artifact a ON a.artifact_id = dva.artifact_id
      WHERE dva.download_version_id = ${downloadVersionId}
        AND dva.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, DownloadArtifactInfo);
    return response.rows;
  }

  /**
   * Get a download version record by ID.
   *
   * `find*` returns null on missing (codebase convention — companion to
   * `getDownloadVersionById`).
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<DownloadVersionRecord | null>}
   * @memberof DownloadVersionRepository
   */
  async findDownloadVersionById(downloadVersionId: string): Promise<DownloadVersionRecord | null> {
    const sql = SQL`
      SELECT
        download_version_id,
        download_id
      FROM download_version
      WHERE download_version_id = ${downloadVersionId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, DownloadVersionRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get a download version record by ID, throwing if not found.
   *
   * Used by the worker to resolve the owning `download_id` from a version.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<DownloadVersionRecord>}
   * @throws {ApiNotFoundError} when no version matches the given ID.
   * @memberof DownloadVersionRepository
   */
  async getDownloadVersionById(downloadVersionId: string): Promise<DownloadVersionRecord> {
    const record = await this.findDownloadVersionById(downloadVersionId);

    if (!record) {
      throw new ApiNotFoundError('Download version not found', [
        'DownloadVersionRepository->getDownloadVersionById',
        `no download_version with id ${downloadVersionId}`
      ]);
    }

    return record;
  }

  /**
   * Get a download version's full materialization-lifecycle status row by ID, throwing if not found.
   *
   * Wider SELECT than `getDownloadVersionById` — surfaces status/timing/error so callers (the worker's
   * status guards, the export ready-gate, the publisher's duplicate gate) judge a version's lifecycle
   * directly off the version row that owns it, with no `download`-side indirection. The not-found throw is
   * the codebase get* convention; all status/ownership/duplicate decisions stay in the calling services.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<DownloadVersionStatusRecord>}
   * @throws {ApiNotFoundError} when no version matches the given ID.
   * @memberof DownloadVersionRepository
   */
  async getDownloadVersionStatusById(downloadVersionId: string): Promise<DownloadVersionStatusRecord> {
    const sql = SQL`
      SELECT
        download_version_id,
        download_id,
        status,
        feature_count,
        started_at,
        completed_at,
        materialized_at,
        error_message,
        create_date
      FROM download_version
      WHERE download_version_id = ${downloadVersionId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, DownloadVersionStatusRecord);

    const record = response.rows[0] ?? null;

    if (!record) {
      throw new ApiNotFoundError('Download version not found', [
        'DownloadVersionRepository->getDownloadVersionStatusById',
        `no download_version with id ${downloadVersionId}`
      ]);
    }

    return record;
  }

  /**
   * List download versions for a download.
   *
   * @param {string} downloadId - The parent download ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<DownloadVersionStatusRecord[]>}
   * @memberof DownloadVersionRepository
   */
  async listDownloadVersions(
    downloadId: string,
    pagination?: ApiPaginationOptions
  ): Promise<DownloadVersionStatusRecord[]> {
    const knex = getKnex();

    const query = knex
      .select([
        'download_version_id',
        'download_id',
        'status',
        'feature_count',
        'started_at',
        'completed_at',
        'materialized_at',
        'error_message',
        'create_date'
      ])
      .from('download_version')
      .where('download_id', downloadId)
      .whereNull('record_end_date');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    if (!pagination?.sort) {
      query.orderBy('create_date', 'desc').orderBy('download_version_id', 'desc');
    }

    const response = await this.connection.knex(query, DownloadVersionStatusRecord);

    return response.rows;
  }

  /**
   * Count download versions for a download.
   *
   * @param {string} downloadId - The parent download ID.
   * @return {Promise<number>}
   * @memberof DownloadVersionRepository
   */
  async listDownloadVersionsCount(downloadId: string): Promise<number> {
    const knex = getKnex();

    const query = knex
      .table('download_version')
      .where('download_id', downloadId)
      .whereNull('record_end_date')
      .select(knex.raw('count(*)::integer as count'));

    const response = await this.connection.knex(query);

    return response.rows[0]?.count ?? 0;
  }
}

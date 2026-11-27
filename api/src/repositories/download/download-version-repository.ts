import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { z } from 'zod';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DownloadArtifactInfo } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import {
  DownloadVersionFeature,
  DownloadVersionRecord,
  DownloadVersionStatusRecord
} from '../../models/download-version';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';
import { isSubmissionFeaturePublished } from '../sql-fragments';

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
   * Store a download version's feature set, once.
   *
   * `featureIdsSql` is a subquery that returns `submission_feature_id` rows, in knex's placeholder
   * form (`?`, as `toSQL().sql` gives it), with its `bindings` in order. The set is aggregated and
   * run-optimised inside the database in one statement; no feature id is returned to the caller. A
   * `null` subquery stores the empty set.
   *
   * The set is written only while `feature_ids` is NULL: the first writer wins, and a retry or a
   * concurrent worker waits on the row lock and then updates nothing. A row count of 0 is therefore
   * not an error — the set was already stored.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @param {(string | null)} featureIdsSql - Feature-id subquery with `?` placeholders, or null for the empty set.
   * @param {readonly Knex.Value[]} bindings - Bindings of `featureIdsSql`, in placeholder order.
   * @return {Promise<void>}
   * @memberof DownloadVersionRepository
   */
  async updateDownloadVersionFeatureIds(
    downloadVersionId: string,
    featureIdsSql: string | null,
    bindings: readonly Knex.Value[]
  ): Promise<void> {
    const featureIds =
      featureIdsSql === null
        ? `rb_build('{}'::integer[])`
        : `COALESCE((
             SELECT rb_build_agg(ids.submission_feature_id) FROM (${featureIdsSql}) ids
           ), rb_build('{}'::integer[]))`;

    // The version id is the last binding, after the subquery's own.
    const query = getKnex().raw(
      `UPDATE download_version
       SET feature_ids = rb_runoptimize(${featureIds})
       WHERE download_version_id = ?
         AND record_end_date IS NULL
         AND feature_ids IS NULL`,
      [...bindings, downloadVersionId]
    );

    await this.connection.knex(query);
  }

  /**
   * Find the size of a download version's stored feature set.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<number | null>} The number of features in the set, or null when the version
   *   has no stored set (or does not exist).
   * @memberof DownloadVersionRepository
   */
  async findDownloadVersionFeatureSetSize(downloadVersionId: string): Promise<number | null> {
    const sql = SQL`
      SELECT
        rb_cardinality(feature_ids)::integer AS feature_set_size
      FROM download_version
      WHERE download_version_id = ${downloadVersionId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, z.object({ feature_set_size: z.number().int().nullable() }));

    return response.rows[0]?.feature_set_size ?? null;
  }

  /**
   * List the feature types of the features in a download version's stored feature set.
   *
   * The set is read once, iterated with the set-returning `rb_iterate` (never built as one
   * `integer[]` value) and joined to `submission_feature` by primary key, as the per-type cursor
   * does. A version with no stored set, or an empty one, has no feature types.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<{ name: string }[]>} One row per distinct feature type name, ordered by name.
   * @memberof DownloadVersionRepository
   */
  async listDownloadVersionFeatureTypeNames(downloadVersionId: string): Promise<{ name: string }[]> {
    const sql = SQL`
      SELECT DISTINCT
        ft.name
      FROM rb_iterate((
        SELECT dv.feature_ids
        FROM download_version dv
        WHERE dv.download_version_id = ${downloadVersionId}
          AND dv.record_end_date IS NULL
      )) AS version_feature(submission_feature_id)
      INNER JOIN submission_feature sf ON sf.submission_feature_id = version_feature.submission_feature_id
      INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
      ORDER BY ft.name;
    `;

    const response = await this.connection.sql(sql, z.object({ name: z.string() }));

    return response.rows;
  }

  /**
   * List one page of the features in a download version's stored feature set.
   *
   * The bitmap is read once per query and the page is cut from it with `rb_select`, so only the
   * page's ids are expanded and the join to `submission_feature` (by primary key) is one page.
   *
   * The list reads by id with the published predicate (`isSubmissionFeaturePublished`), as the
   * ticket specifies. Every member of a built set was current when the set was stored, so
   * published, and nothing clears a publication date, so the predicate excludes no member. No
   * current, closure or security predicate is applied: a feature stays listed after it is
   * superseded or secured. A version with no stored set returns no rows.
   *
   * The order is always ascending `submission_feature_id` (the bitmap's own order); `sort` and
   * `order` in `pagination` are ignored.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @param {ApiPaginationOptions} pagination - The page and page size.
   * @return {Promise<DownloadVersionFeature[]>}
   * @memberof DownloadVersionRepository
   */
  async listDownloadVersionFeatures(
    downloadVersionId: string,
    pagination: ApiPaginationOptions
  ): Promise<DownloadVersionFeature[]> {
    const sql = SQL`
      SELECT
        sf.submission_feature_id,
        sf.uuid,
        sf.submission_id,
        sf.feature_type_id,
        ft.name AS feature_type_name
      FROM unnest(rb_to_array(rb_select(
        (
          SELECT dv.feature_ids
          FROM download_version dv
          WHERE dv.download_version_id = ${downloadVersionId}
            AND dv.record_end_date IS NULL
        ),
        ${pagination.limit}::bigint,
        ${(pagination.page - 1) * pagination.limit}::bigint
      ))) AS page_feature(submission_feature_id)
      INNER JOIN submission_feature sf ON sf.submission_feature_id = page_feature.submission_feature_id
      INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
      WHERE `.append(isSubmissionFeaturePublished('sf')).append(SQL`
      ORDER BY sf.submission_feature_id;
    `);

    const response = await this.connection.sql(sql, DownloadVersionFeature);

    return response.rows;
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
  async listDownloadVersionArtifacts(downloadVersionId: string): Promise<DownloadArtifactInfo[]> {
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
   * Find a download version by ID.
   *
   * Returns the complete lifecycle record so all repository consumers share one canonical version
   * representation. Following the repository `find*` convention, a missing active row returns null.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<DownloadVersionStatusRecord | null>} The matching version, or null when absent.
   * @memberof DownloadVersionRepository
   */
  async findDownloadVersion(downloadVersionId: string): Promise<DownloadVersionStatusRecord | null> {
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

    return response.rows[0] ?? null;
  }

  /**
   * Get a download version record by ID, throwing if not found.
   *
   * @param {string} downloadVersionId - The download version ID.
   * @return {Promise<DownloadVersionStatusRecord>} The complete download version lifecycle record.
   * @throws {ApiNotFoundError} when no version matches the given ID.
   * @memberof DownloadVersionRepository
   */
  async getDownloadVersion(downloadVersionId: string): Promise<DownloadVersionStatusRecord> {
    const record = await this.findDownloadVersion(downloadVersionId);

    if (!record) {
      throw new ApiNotFoundError('Download version not found', [
        'DownloadVersionRepository->getDownloadVersion',
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

import SQL from 'sql-template-strings';
import { z } from 'zod';
import { FRAGMENT_SIZE_THRESHOLD } from '../../constants/download';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  CreateDownload,
  DownloadFeatureSummary,
  DownloadId,
  DownloadListRecord,
  DownloadListRow,
  DownloadRecord,
  HasTeams,
  IsAuthorized
} from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing download data.
 *
 * @export
 * @class DownloadRepository
 * @extends {BaseRepository}
 */
export class DownloadRepository extends BaseRepository {
  /**
   * Create a new download record.
   *
   * Team linking is handled separately via download_team — callers insert
   * into the join table after creating the download record.
   *
   * @param {CreateDownload} payload
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadRepository
   */
  async createDownload(payload: CreateDownload): Promise<DownloadId> {
    const { fragmentSizeBytes, filters } = payload;
    const sizeBytes = fragmentSizeBytes ?? FRAGMENT_SIZE_THRESHOLD;

    const sql = SQL`
      INSERT INTO download (download_status, fragment_size_bytes, filters)
      VALUES ('pending', ${sizeBytes}, ${filters ? JSON.stringify(filters) : null}::jsonb)
      RETURNING download_id;
    `;

    const response = await this.connection.sql(sql, DownloadId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download record', [
        'DownloadRepository->createDownload',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Link submission features to a download request.
   *
   * @param {string} downloadId - The download ID.
   * @param {number[]} submissionFeatureIds - The submission feature IDs to include.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async createDownloadFeatures(downloadId: string, submissionFeatureIds: number[]): Promise<void> {
    if (submissionFeatureIds.length === 0) {
      return;
    }

    const sql = SQL`
      INSERT INTO download_feature (download_id, submission_feature_id)
      SELECT ${downloadId}, unnest(${submissionFeatureIds}::integer[]);
    `;

    await this.connection.sql(sql);
  }

  /**
   * Link a download to a team via the download_team join table.
   *
   * This is the single source of truth for download-to-team relationships.
   * Authenticated downloads get a team row at creation; anonymous downloads have none.
   *
   * @param {string} downloadId - The download ID.
   * @param {string} teamId - The team ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async createDownloadTeam(downloadId: string, teamId: string): Promise<void> {
    const sql = SQL`
      INSERT INTO download_team (download_id, team_id)
      VALUES (${downloadId}, ${teamId});
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to link download to team', [
        'DownloadRepository->createDownloadTeam',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Get a download record by ID.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadRecord | null>}
   * @memberof DownloadRepository
   */
  async findDownloadById(downloadId: string): Promise<DownloadRecord | null> {
    const sql = SQL`
      SELECT
        download_id,
        download_status,
        metadata,
        started_at,
        completed_at,
        downloaded_at,
        total_fragments,
        completed_fragments,
        estimated_total_size_bytes,
        fragment_size_bytes,
        create_date
      FROM download
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get paginated download records accessible to a user, with total count.
   *
   * Uses COUNT(*) OVER() window function to get the total count in the same query,
   * avoiding a second round-trip.
   *
   * Single authorization path: download_team → team → team_member.
   * Returns downloads where the user is a member of any linked team.
   *
   * @param {number} systemUserId - The user ID.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination/sort options.
   * @return {Promise<{ downloads: DownloadListRecord[]; count: number }>}
   * @memberof DownloadRepository
   */
  async getDownloadsByTeamMembership(
    systemUserId: number,
    pagination?: ApiPaginationOptions
  ): Promise<{ downloads: DownloadListRecord[]; count: number }> {
    const knex = getKnex();

    const query = knex
      .select([
        'd.download_id',
        'd.download_status',
        'd.metadata',
        'd.started_at',
        'd.completed_at',
        'd.downloaded_at',
        'd.total_fragments',
        'd.completed_fragments',
        'd.estimated_total_size_bytes',
        'd.fragment_size_bytes',
        'd.create_date',
        knex.raw(
          '(SELECT COUNT(*)::int FROM download_feature df WHERE df.download_id = d.download_id) AS feature_count'
        ),
        knex.raw('COUNT(*) OVER()::int AS total_count')
      ])
      .from('download as d')
      .innerJoin('download_team as dt', 'dt.download_id', 'd.download_id')
      .innerJoin('team_member as tm', 'tm.team_id', 'dt.team_id')
      .where('tm.system_user_id', systemUserId)
      .whereNull('dt.record_end_date')
      .whereNull('tm.record_end_date');

    if (pagination) {
      this.applyPagination(query, pagination);
    }

    // Default sort when no pagination sort is specified
    if (!pagination?.sort) {
      query.orderBy('d.create_date', 'desc');
    }

    const response = await this.connection.knex(query, DownloadListRow);

    const count = response.rows[0]?.total_count ?? 0;
    // Strip the total_count column from each row before returning
    const downloads: DownloadListRecord[] = response.rows.map(({ total_count: _total_count, ...rest }) => rest);

    return { downloads, count };
  }

  /**
   * Update download status by download ID.
   *
   * @param {string} downloadId - The download ID.
   * @param {DownloadStatusEnum} downloadStatus - The new download status.
   * @param {object} [metadata] - Optional metadata (error details, timestamps).
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateDownloadStatus(
    downloadId: string,
    downloadStatus: DownloadStatusEnum,
    metadata?: {
      error?: string;
      started_at?: string;
      completed_at?: string;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET
        download_status = ${downloadStatus},
        metadata = ${JSON.stringify(metadata ?? null)}::jsonb,
        started_at = COALESCE(${metadata?.started_at ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${metadata?.completed_at ?? null}::timestamptz, completed_at)
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download status', [
        'DownloadRepository->updateDownloadStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Mark a download as downloaded (sets downloaded_at timestamp and status).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async markDownloadAsDownloaded(downloadId: string): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET
        download_status = 'downloaded',
        downloaded_at = now()
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to mark download as downloaded', [
        'DownloadRepository->markDownloadAsDownloaded',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Returns features in a download that have NO active security rule.
   *
   * A feature is unsecured if no row exists in submission_feature_security with
   * record_end_date IS NULL — including future-dated rules (no effective_date
   * filter). This is intentionally strict: a feature is secured as soon as a
   * rule is created, not when it takes effect.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFeatureSummary[]>} Unsecured features.
   * @memberof DownloadRepository
   */
  async getUnsecuredDownloadFeatures(downloadId: string): Promise<DownloadFeatureSummary[]> {
    const sql = SQL`
      SELECT
        sf.submission_feature_id,
        sf.submission_id,
        ft.name AS feature_type_name,
        sf.data_byte_size AS estimated_byte_size
      FROM download_feature df
      INNER JOIN submission_feature sf ON df.submission_feature_id = sf.submission_feature_id
      INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
      WHERE df.download_id = ${downloadId}
        AND NOT EXISTS (
          SELECT 1
          FROM submission_feature_security sfs
          WHERE sfs.submission_feature_id = sf.submission_feature_id
            AND sfs.record_end_date IS NULL
        );
    `;

    const response = await this.connection.sql(sql, DownloadFeatureSummary);
    return response.rows;
  }

  /**
   * Returns features in a download that have active security rules AND the
   * download's team members have policy access to view them.
   *
   * Policy chain: download_team → team_member (download team) → team_member
   * (same user, policy teams) → team_policy → policy_statement (ALLOW).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFeatureSummary[]>} Secured, authorized features.
   * @memberof DownloadRepository
   */
  async getSecuredAuthorizedFeatures(downloadId: string): Promise<DownloadFeatureSummary[]> {
    const sql = SQL`
      SELECT
        sf.submission_feature_id,
        sf.submission_id,
        ft.name AS feature_type_name,
        sf.data_byte_size AS estimated_byte_size
      FROM download_feature df
      INNER JOIN submission_feature sf ON df.submission_feature_id = sf.submission_feature_id
      INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
      WHERE df.download_id = ${downloadId}
        AND EXISTS (
          SELECT 1
          FROM submission_feature_security sfs
          WHERE sfs.submission_feature_id = sf.submission_feature_id
            AND sfs.record_end_date IS NULL
        )
        AND EXISTS (
          SELECT 1
          FROM download_team dt
          INNER JOIN team_member tm_dl ON tm_dl.team_id = dt.team_id AND tm_dl.record_end_date IS NULL
          INNER JOIN team_member tm_pol ON tm_pol.system_user_id = tm_dl.system_user_id AND tm_pol.record_end_date IS NULL
          INNER JOIN team_policy tp ON tp.team_id = tm_pol.team_id AND tp.record_end_date IS NULL
          INNER JOIN policy_statement ps ON ps.policy_id = tp.policy_id AND ps.record_end_date IS NULL
          WHERE dt.download_id = ${downloadId}
            AND dt.record_end_date IS NULL
            AND ps.effect = 'allow'
            AND (ps.urn_submission_id = sf.submission_id::text OR ps.urn_submission_id = '*')
            AND (ps.urn_feature_type = ft.name OR ps.urn_feature_type = '*')
            AND (ps.urn_feature_id = sf.submission_feature_id::text OR ps.urn_feature_id = '*')
        );
    `;

    const response = await this.connection.sql(sql, DownloadFeatureSummary);
    return response.rows;
  }

  /**
   * Returns which of the given feature IDs have active security rules.
   *
   * This query is intentionally trivial — it must be obviously correct so it
   * can serve as a reliable cross-check against the more complex query logic.
   *
   * @param {number[]} submissionFeatureIds - Feature IDs to check.
   * @return {Promise<Set<number>>} Set of feature IDs that are secured.
   * @memberof DownloadRepository
   */
  async getSecuredFeatureIds(submissionFeatureIds: number[]): Promise<Set<number>> {
    if (submissionFeatureIds.length === 0) {
      return new Set();
    }

    const sql = SQL`
      SELECT DISTINCT submission_feature_id
      FROM submission_feature_security
      WHERE submission_feature_id = ANY(${submissionFeatureIds}::int[])
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, z.object({ submission_feature_id: z.number() }));
    return new Set(response.rows.map((r) => r.submission_feature_id));
  }

  /**
   * Update fragment counts on a download record.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} totalFragments - Total number of fragments.
   * @param {number} completedFragments - Number of completed fragments.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateDownloadFragmentCounts(
    downloadId: string,
    totalFragments: number,
    completedFragments: number
  ): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET total_fragments = ${totalFragments}, completed_fragments = ${completedFragments}
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update download fragment counts', [
        'DownloadRepository->updateDownloadFragmentCounts',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Update estimated total size on a download record.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} bytes - Estimated total size in bytes.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateEstimatedTotalSize(downloadId: string, bytes: number): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET estimated_total_size_bytes = ${bytes}
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update estimated total size', [
        'DownloadRepository->updateEstimatedTotalSize',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }

  /**
   * Check if a user is authorized to access a specific download.
   *
   * Single authorization path: download_team → team → team_member.
   * Anonymous downloads (no download_team rows) are not checked here —
   * callers handle that separately via isDownloadClaimedByTeam.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} systemUserId - The user ID.
   * @return {Promise<boolean>}
   * @memberof DownloadRepository
   */
  async isUserAuthorizedForDownload(downloadId: string, systemUserId: number): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1
        FROM download_team dt
        JOIN team_member tm ON tm.team_id = dt.team_id
        WHERE dt.download_id = ${downloadId}
          AND tm.system_user_id = ${systemUserId}
          AND dt.record_end_date IS NULL
          AND tm.record_end_date IS NULL
      ) AS authorized;
    `;

    const response = await this.connection.sql(sql, IsAuthorized);

    return response.rows[0]?.authorized ?? false;
  }

  /**
   * Check if a download has any active team associations.
   * No teams = anonymous download (UUID is the credential).
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<boolean>}
   * @memberof DownloadRepository
   */
  async isDownloadClaimedByTeam(downloadId: string): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        SELECT 1 FROM download_team dt
        WHERE dt.download_id = ${downloadId}
          AND dt.record_end_date IS NULL
      ) AS has_teams;
    `;

    const response = await this.connection.sql(sql, HasTeams);

    return response.rows[0]?.has_teams ?? false;
  }
}

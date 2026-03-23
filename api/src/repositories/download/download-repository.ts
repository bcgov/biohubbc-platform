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
   * Returns all features linked to a download.
   *
   * Authorization is enforced at creation time via filterAuthorizedFeatureIds —
   * only authorized features are ever linked. At retrieval time we return
   * everything that was linked, avoiding the download_team → policy_team hop
   * that would let later team membership changes alter which features are visible.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFeatureSummary[]>} All linked features.
   * @memberof DownloadRepository
   */
  async getDownloadFeatures(downloadId: string): Promise<DownloadFeatureSummary[]> {
    const knex = getKnex();

    const query = knex
      .select([
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('ft.name AS feature_type_name'),
        knex.raw('sf.data_byte_size AS estimated_byte_size')
      ])
      .from('download_feature as df')
      .innerJoin('submission_feature as sf', 'df.submission_feature_id', 'sf.submission_feature_id')
      .innerJoin('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('df.download_id', downloadId);

    const response = await this.connection.knex(query, DownloadFeatureSummary);
    return response.rows;
  }

  /**
   * Returns which of the given feature IDs are secured — directly or by
   * inheriting security from an ancestor.
   *
   * Walks DOWN from secured roots to all descendants, the opposite direction
   * of buildSecurityCheck() (which walks UP from a feature to its ancestors).
   * Using a different traversal direction makes this a genuine cross-check:
   * if the two methods disagree, there's a bug.
   *
   * Scoped to submissions containing the candidate features to avoid walking
   * every secured tree in the system.
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
      WITH RECURSIVE secured_descendants AS (
        -- Base: directly secured features, scoped to relevant submissions
        SELECT sfs.submission_feature_id
        FROM submission_feature_security sfs
        INNER JOIN submission_feature sf ON sf.submission_feature_id = sfs.submission_feature_id
        WHERE sfs.record_end_date IS NULL
          AND sf.submission_id IN (
            SELECT submission_id FROM submission_feature
            WHERE submission_feature_id = ANY(${submissionFeatureIds}::int[])
          )

        UNION ALL

        -- Walk down to children
        SELECT child.submission_feature_id
        FROM submission_feature child
        INNER JOIN secured_descendants sd ON child.parent_submission_feature_id = sd.submission_feature_id
      )
      SELECT DISTINCT submission_feature_id
      FROM secured_descendants
      WHERE submission_feature_id = ANY(${submissionFeatureIds}::int[]);
    `;

    const response = await this.connection.sql(sql, z.object({ submission_feature_id: z.number() }));
    return new Set(response.rows.map((r) => r.submission_feature_id));
  }

  /**
   * Returns which of the given secured feature IDs the user has access to
   * via scope-based walk-up.
   *
   * For each secured feature, walks UP the parent chain to check if any ancestor
   * is a scope anchor for the user's teams. Same walk-up strategy as the search
   * security filter — cost is O(input_size × tree_depth), bounded by the download's
   * feature set (hundreds) and tree height (~5 levels), not by table size.
   *
   * Used at download creation time before the download_team link exists — unlike
   * getSecuredAuthorizedFeatures which checks via the download's teams.
   *
   * @param {number[]} submissionFeatureIds - Secured feature IDs to check.
   * @param {number} systemUserId - The user to check policies for.
   * @return {Promise<Set<number>>} Feature IDs the user is authorized to access.
   * @memberof DownloadRepository
   */
  async getUserAuthorizedSecuredFeatureIds(submissionFeatureIds: number[], systemUserId: number): Promise<Set<number>> {
    if (submissionFeatureIds.length === 0) {
      return new Set();
    }

    const knex = getKnex();

    const query = knex
      .select('sf.submission_feature_id')
      .from('submission_feature as sf')
      .whereIn('sf.submission_feature_id', submissionFeatureIds)
      .andWhereRaw(
        `EXISTS (
          WITH RECURSIVE ancestors AS (
            SELECT sf2.submission_feature_id, sf2.parent_submission_feature_id
            FROM submission_feature sf2
            WHERE sf2.submission_feature_id = sf.submission_feature_id
            UNION ALL
            SELECT p.submission_feature_id, p.parent_submission_feature_id
            FROM submission_feature p
            JOIN ancestors a ON a.parent_submission_feature_id = p.submission_feature_id
          )
          SELECT 1 FROM ancestors a
          JOIN security_scope_anchor ssa ON ssa.anchor_submission_feature_id = a.submission_feature_id
          JOIN team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
          JOIN team_member tm ON tm.team_id = tss.team_id
            AND tm.system_user_id = ?
            AND tm.record_end_date IS NULL
        )`,
        [systemUserId]
      );

    const response = await this.connection.knex(query, z.object({ submission_feature_id: z.number() }));
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

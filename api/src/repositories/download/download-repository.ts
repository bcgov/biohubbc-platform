import SQL from 'sql-template-strings';
import { z } from 'zod';
import { FRAGMENT_SIZE_THRESHOLD } from '../../constants/download';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { DownloadFeatureSummary, DownloadId, DownloadRecord } from '../../models/download';
import { DownloadStatusEnum } from '../../models/download-status';
import { BaseRepository } from '../base-repository';

const IsAuthorized = z.object({ authorized: z.boolean() });
type IsAuthorized = z.infer<typeof IsAuthorized>;

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
   * @param {string | null} teamId - The team that owns this download. Null for anonymous downloads.
   * @param {string | null} dataRequestId - The data request that originated this download. Null for non-request downloads.
   * @param {number} [fragmentSizeBytes] - Target fragment size in bytes. Defaults to FRAGMENT_SIZE_THRESHOLD (200 MB).
   * @param {number | null} [systemUserId] - The user who created this download. Null for anonymous downloads.
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadRepository
   */
  async createDownload(
    teamId: string | null,
    dataRequestId: string | null,
    fragmentSizeBytes?: number,
    systemUserId?: number | null
  ): Promise<DownloadId> {
    const sizeBytes = fragmentSizeBytes ?? FRAGMENT_SIZE_THRESHOLD;

    const sql = SQL`
      INSERT INTO download (team_id, data_request_id, download_status, fragment_size_bytes, system_user_id)
      VALUES (${teamId}, ${dataRequestId}, 'pending', ${sizeBytes}, ${systemUserId ?? null})
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
        system_user_id,
        team_id,
        data_request_id,
        download_status,
        metadata,
        started_at,
        completed_at,
        downloaded_at,
        total_fragments,
        completed_fragments,
        estimated_total_size_bytes,
        fragment_size_bytes
      FROM download
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadRecord);

    return response.rows[0] ?? null;
  }

  /**
   * Get all download records accessible to a user.
   *
   * Three authorization paths:
   * - Owner: user created or claimed the download (system_user_id matches).
   * - Shared: user has a direct entry in download_share.
   * - Data request: user is a member of the data request's approved team.
   *
   * @param {number} systemUserId - The user ID.
   * @return {Promise<DownloadRecord[]>}
   * @memberof DownloadRepository
   */
  async getDownloadsByTeamMembership(systemUserId: number): Promise<DownloadRecord[]> {
    const sql = SQL`
      SELECT
        d.download_id,
        d.system_user_id,
        d.team_id,
        d.data_request_id,
        d.download_status,
        d.metadata,
        d.started_at,
        d.completed_at,
        d.downloaded_at,
        d.total_fragments,
        d.completed_fragments,
        d.estimated_total_size_bytes,
        d.fragment_size_bytes
      FROM download d
      WHERE
        -- Downloads I created or claimed
        d.system_user_id = ${systemUserId}
        OR
        -- Downloads shared with me
        d.download_id IN (
          SELECT ds.download_id FROM download_share ds
          WHERE ds.system_user_id = ${systemUserId}
            AND ds.record_end_date IS NULL
        )
        OR
        -- Downloads via approved data requests
        d.download_id IN (
          SELECT d2.download_id FROM download d2
          JOIN data_request dr ON dr.data_request_id = d2.data_request_id
          JOIN team_member tm ON tm.team_id = dr.team_id
          WHERE tm.system_user_id = ${systemUserId}
            AND tm.record_end_date IS NULL
        )
      ORDER BY d.create_date DESC;
    `;

    const response = await this.connection.sql(sql, DownloadRecord);

    return response.rows;
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
   * Get lightweight summaries for all authorized features in a download.
   *
   * Returns feature metadata and pre-computed data_byte_size (no JSONB data column).
   * Used by estimateDownloadSize and planFragments for bin packing.
   *
   * @param {string} downloadId - The download ID.
   * @param {string | null} teamId - The team that owns the download. Null for anonymous downloads (only unsecured features returned).
   * @return {Promise<DownloadFeatureSummary[]>}
   * @memberof DownloadRepository
   */
  async getDownloadFeatureSummaries(downloadId: string, teamId: string | null): Promise<DownloadFeatureSummary[]> {
    const sql = SQL`
      SELECT
        sf.submission_feature_id,
        sf.submission_id,
        ft.name as feature_type_name,
        sf.data_byte_size as estimated_byte_size
      FROM download_feature df
      INNER JOIN submission_feature sf ON df.submission_feature_id = sf.submission_feature_id
      INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
      WHERE df.download_id = ${downloadId}
        AND (
          -- Unsecured features: no active security rule
          NOT EXISTS (
            SELECT 1
            FROM submission_feature_security sfs
            WHERE sfs.submission_feature_id = sf.submission_feature_id
              AND sfs.record_end_date IS NULL
          )
          OR
          -- Secured features: team has a matching ALLOW policy
          EXISTS (
            SELECT 1
            FROM policy_statement ps
            INNER JOIN team_policy tp ON tp.policy_id = ps.policy_id AND tp.record_end_date IS NULL
            WHERE tp.team_id = ${teamId}
              AND ps.record_end_date IS NULL
              AND ps.effect = 'allow'
              AND (ps.urn_submission_id = sf.submission_id::text OR ps.urn_submission_id = '*')
              AND (ps.urn_feature_type = ft.name OR ps.urn_feature_type = '*')
              AND (ps.urn_feature_id = sf.submission_feature_id::text OR ps.urn_feature_id = '*')
          )
        );
    `;

    const response = await this.connection.sql(sql, DownloadFeatureSummary);

    return response.rows;
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
   * Three authorization paths:
   * - Owner: user created or claimed the download (system_user_id matches).
   * - Shared: user has a direct entry in download_share.
   * - Data request: user is a member of the data request's approved team.
   *
   * Anonymous downloads (system_user_id IS NULL AND team_id IS NULL) are not checked here —
   * callers handle that separately.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} systemUserId - The user ID.
   * @return {Promise<boolean>}
   * @memberof DownloadRepository
   */
  async isUserAuthorizedForDownload(downloadId: string, systemUserId: number): Promise<boolean> {
    const sql = SQL`
      SELECT EXISTS (
        -- Owner: user created or claimed this download
        SELECT 1 FROM download d
        WHERE d.download_id = ${downloadId}
          AND d.system_user_id = ${systemUserId}
        UNION ALL
        -- Shared: user has a direct entry in download_share
        SELECT 1 FROM download_share ds
        WHERE ds.download_id = ${downloadId}
          AND ds.system_user_id = ${systemUserId}
          AND ds.record_end_date IS NULL
        UNION ALL
        -- Data request: user is a member of the data request's approved team
        SELECT 1 FROM download d
        JOIN data_request dr ON dr.data_request_id = d.data_request_id
        JOIN team_member tm ON tm.team_id = dr.team_id
        WHERE d.download_id = ${downloadId}
          AND tm.system_user_id = ${systemUserId}
          AND tm.record_end_date IS NULL
      ) AS authorized;
    `;

    const response = await this.connection.sql(sql, IsAuthorized);

    return response.rows[0]?.authorized ?? false;
  }

  /**
   * Claim an anonymous download by setting the owner.
   *
   * Only succeeds if the download has no existing owner and no team association.
   *
   * @param {string} downloadId - The download ID.
   * @param {number} systemUserId - The user ID to set as owner.
   * @return {Promise<boolean>} True if claimed, false if already owned or not found.
   * @memberof DownloadRepository
   */
  async claimDownload(downloadId: string, systemUserId: number): Promise<boolean> {
    const sql = SQL`
      UPDATE download
      SET system_user_id = ${systemUserId}
      WHERE download_id = ${downloadId}
        AND system_user_id IS NULL
        AND team_id IS NULL;
    `;

    const response = await this.connection.sql(sql);

    return response.rowCount === 1;
  }
}

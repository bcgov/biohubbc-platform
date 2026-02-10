import SQL from 'sql-template-strings';
import { FRAGMENT_SIZE_THRESHOLD } from '../constants/download';
import { ApiExecuteSQLError } from '../errors/api-error';
import { DownloadFeatureRecord, DownloadFeatureSummary, DownloadId, DownloadRecord } from '../models/download';
import { DownloadStatusEnum } from '../models/download-status';
import { BaseRepository } from './base-repository';

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
   * @param {number} systemUserId - The user who initiated the download.
   * @param {number} [fragmentSizeBytes] - Target fragment size in bytes. Defaults to FRAGMENT_SIZE_THRESHOLD (500 MB).
   * @return {Promise<DownloadId>} The created record ID.
   * @memberof DownloadRepository
   */
  async createDownload(systemUserId: number, fragmentSizeBytes?: number): Promise<DownloadId> {
    const sizeBytes = fragmentSizeBytes ?? FRAGMENT_SIZE_THRESHOLD;

    const sql = SQL`
      INSERT INTO download (system_user_id, download_status, fragment_size_bytes)
      VALUES (${systemUserId}, 'pending', ${sizeBytes})
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
   * @param {number} downloadId - The download ID.
   * @param {number[]} submissionFeatureIds - The submission feature IDs to include.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async createDownloadFeatures(downloadId: number, submissionFeatureIds: number[]): Promise<void> {
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
   * @param {number} downloadId - The download ID.
   * @return {Promise<DownloadRecord | null>}
   * @memberof DownloadRepository
   */
  async findDownloadById(downloadId: number): Promise<DownloadRecord | null> {
    const sql = SQL`
      SELECT
        download_id,
        system_user_id,
        download_status,
        s3_key,
        file_name,
        file_size_bytes,
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
   * Get all download records for a user.
   *
   * @param {number} systemUserId - The user ID.
   * @return {Promise<DownloadRecord[]>}
   * @memberof DownloadRepository
   */
  async getDownloadsByUserId(systemUserId: number): Promise<DownloadRecord[]> {
    const sql = SQL`
      SELECT
        download_id,
        system_user_id,
        download_status,
        s3_key,
        file_name,
        file_size_bytes,
        metadata,
        started_at,
        completed_at,
        downloaded_at,
        total_fragments,
        completed_fragments,
        estimated_total_size_bytes,
        fragment_size_bytes
      FROM download
      WHERE system_user_id = ${systemUserId}
      ORDER BY create_date DESC;
    `;

    const response = await this.connection.sql(sql, DownloadRecord);

    return response.rows;
  }

  /**
   * Update download status by download ID.
   *
   * @param {number} downloadId - The download ID.
   * @param {DownloadStatusEnum} downloadStatus - The new download status.
   * @param {object} [metadata] - Optional metadata (s3_key, file_name, file_size_bytes, error details).
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateDownloadStatus(
    downloadId: number,
    downloadStatus: DownloadStatusEnum,
    metadata?: {
      s3_key?: string;
      file_name?: string;
      file_size_bytes?: string | number;
      error?: string;
      started_at?: string;
      completed_at?: string;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download
      SET
        download_status = ${downloadStatus},
        s3_key = COALESCE(${metadata?.s3_key ?? null}, s3_key),
        file_name = COALESCE(${metadata?.file_name ?? null}, file_name),
        file_size_bytes = COALESCE(${metadata?.file_size_bytes ?? null}, file_size_bytes),
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
   * @param {number} downloadId - The download ID.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async markDownloadAsDownloaded(downloadId: number): Promise<void> {
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
   * Get submission feature IDs linked to a download.
   *
   * @param {number} downloadId - The download ID.
   * @return {Promise<DownloadFeatureRecord[]>}
   * @memberof DownloadRepository
   */
  async getDownloadFeatures(downloadId: number): Promise<DownloadFeatureRecord[]> {
    const sql = SQL`
      SELECT
        download_feature_id,
        download_id,
        submission_feature_id
      FROM download_feature
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadFeatureRecord);

    return response.rows;
  }

  /**
   * Get lightweight summaries for all authorized features in a download.
   *
   * Returns feature metadata and pre-computed data_byte_size (no JSONB data column).
   * Used by estimateDownloadSize and planFragments for bin packing.
   *
   * @param {number} downloadId - The download ID.
   * @param {number} systemUserId - The user requesting the download.
   * @return {Promise<DownloadFeatureSummary[]>}
   * @memberof DownloadRepository
   */
  async getDownloadFeatureSummaries(downloadId: number, systemUserId: number): Promise<DownloadFeatureSummary[]> {
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
          -- Secured features: user has a matching ALLOW policy via team membership
          EXISTS (
            SELECT 1
            FROM policy_statement ps
            INNER JOIN team_policy tp ON tp.policy_id = ps.policy_id AND tp.record_end_date IS NULL
            INNER JOIN team_member tm ON tm.team_id = tp.team_id AND tm.record_end_date IS NULL
            WHERE tm.system_user_id = ${systemUserId}
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
   * @param {number} downloadId - The download ID.
   * @param {number} totalFragments - Total number of fragments.
   * @param {number} completedFragments - Number of completed fragments.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateDownloadFragmentCounts(
    downloadId: number,
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
   * @param {number} downloadId - The download ID.
   * @param {number} bytes - Estimated total size in bytes.
   * @return {Promise<void>}
   * @memberof DownloadRepository
   */
  async updateEstimatedTotalSize(downloadId: number, bytes: number): Promise<void> {
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
}

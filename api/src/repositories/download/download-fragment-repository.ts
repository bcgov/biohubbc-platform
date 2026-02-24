import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { DownloadFeatureData } from '../../models/download';
import { DownloadFragmentId, DownloadFragmentRecord } from '../../models/download-fragment';
import { DownloadStatusEnum } from '../../models/download-status';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing download fragment data.
 *
 * @export
 * @class DownloadFragmentRepository
 * @extends {BaseRepository}
 */
export class DownloadFragmentRepository extends BaseRepository {
  /**
   * Create a new download fragment record.
   *
   * @param {string} downloadId - The parent download ID.
   * @param {number} fragmentIndex - Zero-based fragment ordering index.
   * @param {number} estimatedSizeBytes - Estimated size of this fragment in bytes.
   * @param {number} featureCount - Number of features assigned to this fragment.
   * @return {Promise<DownloadFragmentId>}
   * @memberof DownloadFragmentRepository
   */
  async createDownloadFragment(
    downloadId: string,
    fragmentIndex: number,
    estimatedSizeBytes: number,
    featureCount: number
  ): Promise<DownloadFragmentId> {
    const sql = SQL`
      INSERT INTO download_fragment (download_id, fragment_index, estimated_size_bytes, feature_count)
      VALUES (${downloadId}, ${fragmentIndex}, ${estimatedSizeBytes}, ${featureCount})
      RETURNING download_fragment_id;
    `;

    const response = await this.connection.sql(sql, DownloadFragmentId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download fragment record', [
        'DownloadFragmentRepository->createDownloadFragment',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Link submission features to a download fragment.
   *
   * @param {number} downloadFragmentId - The fragment ID.
   * @param {number[]} submissionFeatureIds - The submission feature IDs to include.
   * @return {Promise<void>}
   * @memberof DownloadFragmentRepository
   */
  async createDownloadFragmentFeatures(downloadFragmentId: number, submissionFeatureIds: number[]): Promise<void> {
    if (submissionFeatureIds.length === 0) {
      return;
    }

    const sql = SQL`
      INSERT INTO download_fragment_feature (download_fragment_id, submission_feature_id)
      SELECT ${downloadFragmentId}, unnest(${submissionFeatureIds}::integer[]);
    `;

    await this.connection.sql(sql);
  }

  /**
   * Get all fragments for a download, ordered by index.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadFragmentRecord[]>}
   * @memberof DownloadFragmentRepository
   */
  async getFragmentsByDownloadId(downloadId: string): Promise<DownloadFragmentRecord[]> {
    const sql = SQL`
      SELECT
        download_fragment_id,
        download_id,
        fragment_index,
        fragment_status,
        s3_key,
        file_name,
        file_size_bytes,
        estimated_size_bytes,
        feature_count,
        started_at,
        completed_at,
        error_message
      FROM download_fragment
      WHERE download_id = ${downloadId}
      ORDER BY fragment_index;
    `;

    const response = await this.connection.sql(sql, DownloadFragmentRecord);

    return response.rows;
  }

  /**
   * Get distinct feature type names for a fragment.
   *
   * @param {number} downloadFragmentId - The fragment ID.
   * @return {Promise<string[]>} Ordered list of feature type names.
   * @memberof DownloadFragmentRepository
   */
  async getFragmentFeatureTypes(downloadFragmentId: number): Promise<string[]> {
    const result = await this.connection.query<{ feature_type_name: string }>(
      `SELECT DISTINCT ft.name as feature_type_name
        FROM download_fragment_feature dff
        INNER JOIN submission_feature sf ON dff.submission_feature_id = sf.submission_feature_id
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        WHERE dff.download_fragment_id = $1
        ORDER BY ft.name`,
      [downloadFragmentId]
    );

    return result.rows.map((r) => r.feature_type_name);
  }

  /**
   * Stream feature data for a specific type within a fragment using a server-side cursor.
   *
   * Yields batches of features to avoid loading all JSONB data into memory at once.
   * Must be called within an open transaction (cursors require a transaction context).
   *
   * @param {number} downloadFragmentId - The fragment ID.
   * @param {string} featureTypeName - The feature type to stream.
   * @param {number} [batchSize=500] - Number of rows to fetch per batch.
   * @yields {DownloadFeatureData[]} Batches of feature data.
   * @memberof DownloadFragmentRepository
   */
  async *streamFragmentFeaturesByType(
    downloadFragmentId: number,
    featureTypeName: string,
    batchSize = 5000
  ): AsyncGenerator<DownloadFeatureData[]> {
    const cursorName = `frag_cursor_${downloadFragmentId}_${featureTypeName.replace(/[^a-z0-9_]/gi, '_')}`;

    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
        SELECT
          sf.submission_feature_id,
          sf.submission_id,
          sf.uuid,
          ft.name as feature_type_name,
          sf.data,
          parent_sf.data as parent_data,
          parent_ft.name as parent_feature_type_name
        FROM download_fragment_feature dff
        INNER JOIN submission_feature sf ON dff.submission_feature_id = sf.submission_feature_id
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        LEFT JOIN submission_feature parent_sf ON sf.parent_submission_feature_id = parent_sf.submission_feature_id
        LEFT JOIN feature_type parent_ft ON parent_sf.feature_type_id = parent_ft.feature_type_id
        WHERE dff.download_fragment_id = $1
          AND ft.name = $2`,
      [downloadFragmentId, featureTypeName]
    );

    try {
      while (true) {
        const result = await this.connection.query<DownloadFeatureData>(`FETCH ${batchSize} FROM ${cursorName}`);

        if (result.rows.length === 0) {
          break;
        }

        yield result.rows;
      }
    } finally {
      await this.connection.query(`CLOSE ${cursorName}`);
    }
  }

  /**
   * Get root dataset info for all submissions in a fragment.
   *
   * Uses a recursive CTE to walk up the parent_submission_feature_id chain
   * to find the root dataset for each submission. This is called once per
   * fragment (not per row) for efficient caching.
   *
   * @param {number} downloadFragmentId - The fragment ID.
   * @return {Promise<Map<number, { dataset_id: number; dataset_name: string }|}>>} Map of submission_id to root dataset info.
   * @memberof DownloadFragmentRepository
   */
  async getRootDatasetsByFragment(
    downloadFragmentId: number
  ): Promise<Map<number, { dataset_uuid: string; dataset_name: string | null }>> {
    // Get distinct submission_ids, then find each submission's root dataset
    // using a recursive CTE that walks up the parent chain
    const result = await this.connection.query<{
      submission_id: number;
      dataset_uuid: string;
      dataset_name: string | null;
    }>(
      `WITH DISTINCT_SUBMISSIONS AS (
        SELECT DISTINCT sf.submission_id
        FROM download_fragment_feature dff
        INNER JOIN submission_feature sf ON dff.submission_feature_id = sf.submission_feature_id
        WHERE dff.download_fragment_id = $1
      ),
      ROOT_DATASETS AS (
        SELECT
          sf.submission_id,
          sf.uuid as dataset_uuid,
          sf.data->>'name' as dataset_name
        FROM submission_feature sf
        INNER JOIN feature_type ft ON sf.feature_type_id = ft.feature_type_id
        WHERE sf.submission_id IN (SELECT submission_id FROM DISTINCT_SUBMISSIONS)
          AND ft.name = 'dataset'
          AND sf.parent_submission_feature_id IS NULL
      )
      SELECT * FROM ROOT_DATASETS`,
      [downloadFragmentId]
    );

    const map = new Map<number, { dataset_uuid: string; dataset_name: string | null }>();
    for (const row of result.rows) {
      map.set(row.submission_id, { dataset_uuid: row.dataset_uuid, dataset_name: row.dataset_name });
    }
    return map;
  }

  /**
   * Update fragment status with optional metadata.
   *
   * @param {number} downloadFragmentId - The fragment ID.
   * @param {DownloadStatusEnum} status - The new status.
   * @param {object} [metadata] - Optional metadata (s3_key, file_name, file_size_bytes, error_message).
   * @return {Promise<void>}
   * @memberof DownloadFragmentRepository
   */
  async updateFragmentStatus(
    downloadFragmentId: number,
    status: DownloadStatusEnum,
    metadata?: {
      s3_key?: string;
      file_name?: string;
      file_size_bytes?: string | number;
      error_message?: string;
      started_at?: string;
      completed_at?: string;
    }
  ): Promise<void> {
    const sql = SQL`
      UPDATE download_fragment
      SET
        fragment_status = ${status},
        s3_key = COALESCE(${metadata?.s3_key ?? null}, s3_key),
        file_name = COALESCE(${metadata?.file_name ?? null}, file_name),
        file_size_bytes = COALESCE(${metadata?.file_size_bytes ?? null}, file_size_bytes),
        error_message = COALESCE(${metadata?.error_message ?? null}, error_message),
        started_at = COALESCE(${metadata?.started_at ?? null}::timestamptz, started_at),
        completed_at = COALESCE(${metadata?.completed_at ?? null}::timestamptz, completed_at)
      WHERE download_fragment_id = ${downloadFragmentId};
    `;

    const response = await this.connection.sql(sql);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update fragment status', [
        'DownloadFragmentRepository->updateFragmentStatus',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }
  }
}

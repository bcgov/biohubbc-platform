import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { DownloadExportId, DownloadExportRecord } from '../../models/download-export';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for accessing download export data.
 *
 * Export jobs track per-download format conversions (e.g. parquet -> CSV).
 * Tables exist for future export pipeline; export job creation comes in
 * a follow-up ticket that replaces the current fragment-based approach.
 *
 * @export
 * @class DownloadExportRepository
 * @extends {BaseRepository}
 */
export class DownloadExportRepository extends BaseRepository {
  /**
   * Create a new download export record.
   *
   * @param {string} downloadId - The download ID.
   * @param {string} format - The export output format (e.g. 'parquet', 'csv').
   * @return {Promise<DownloadExportId>}
   * @memberof DownloadExportRepository
   */
  async createDownloadExport(downloadId: string, format: string): Promise<DownloadExportId> {
    const sql = SQL`
      INSERT INTO download_export (download_id, format)
      VALUES (${downloadId}, ${format})
      RETURNING download_export_id;
    `;

    const response = await this.connection.sql(sql, DownloadExportId);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert download export record', [
        'DownloadExportRepository->createDownloadExport',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all export records for a download.
   *
   * @param {string} downloadId - The download ID.
   * @return {Promise<DownloadExportRecord[]>}
   * @memberof DownloadExportRepository
   */
  async getDownloadExportsByDownloadId(downloadId: string): Promise<DownloadExportRecord[]> {
    const sql = SQL`
      SELECT
        download_export_id,
        download_id,
        format,
        status,
        started_at,
        completed_at,
        error_message
      FROM download_export
      WHERE download_id = ${downloadId};
    `;

    const response = await this.connection.sql(sql, DownloadExportRecord);
    return response.rows;
  }
}

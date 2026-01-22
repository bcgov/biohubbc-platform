import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { CreateUpload, UpdateUpload, Upload } from '../../models/upload';
import { BaseRepository } from '../base-repository';

export class UploadRepository extends BaseRepository {
  /**
   * Get a single upload record by ID
   *
   * @param {string} uploadId
   * @returns {Promise<Upload>}
   */
  async getUpload(uploadId: string): Promise<Upload> {
    const sqlStatement = SQL`
      SELECT
        upload_id,
        s3_upload_id,
        upload_status,
        record_end_date,
        create_user
      FROM
        upload
      WHERE
        upload_id = ${uploadId};
    `;

    const response = await this.connection.sql(sqlStatement, Upload);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get upload record', [
        'UploadRepository->getUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get upload records
   *
   * @returns {Promise<Upload[]>}
   */
  async getUploads(): Promise<Upload[]> {
    const sqlStatement = SQL`
      SELECT
        upload_id,
        s3_upload_id,
        upload_status,
        record_end_date,
        create_user
      FROM
        upload;
    `;

    const response = await this.connection.sql(sqlStatement, Upload);

    return response.rows;
  }

  /**
   * Insert a new upload
   */
  async insertUpload(upload: CreateUpload): Promise<{ upload_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO upload (
        upload_status,
        s3_upload_id,
        record_end_date
      ) VALUES (
        ${upload.upload_status},
        ${upload.s3_upload_id},
        ${upload.record_end_date ?? null}
      )
      RETURNING upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert upload record', [
        'UploadRepository->insertUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload
   */
  async updateUpload(uploadId: string, upload: UpdateUpload): Promise<{ upload_id: string }> {
    const sqlStatement = SQL`
      UPDATE upload
      SET
        upload_status = COALESCE(${upload.upload_status}, upload_status),
        s3_upload_id = COALESCE(${upload.s3_upload_id}, s3_upload_id),
        record_end_date = COALESCE(${upload.record_end_date}, record_end_date)
      WHERE
        upload_id = ${uploadId}
      RETURNING upload_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update upload record', [
        'UploadRepository->updateUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete an upload record by ID
   */
  async deleteUpload(uploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM upload
      WHERE upload_id = ${uploadId};
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete upload record', [
        'UploadRepository->deleteUpload',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}

import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CreateUploadArchive, UpdateUploadArchive, UploadArchive } from '../../models/upload-archive';
import { BaseRepository } from '../base-repository';

export class UploadArchiveRepository extends BaseRepository {
  /**
   * Get a single upload archive by ID
   *
   * @param {string} uploadArchiveId - The ID of the upload archive to retrieve.
   * @returns {Promise<UploadArchive>} - The upload archive record.
   * @throws {ApiExecuteSQLError} - Throws an error if the upload archive is not found.
   */
  async getUploadArchive(uploadArchiveId: string): Promise<UploadArchive> {
    const sqlStatement = SQL`
      SELECT
        upload_archive_id,
        upload_id,
        artifact_id,
        archive_status
      FROM
        upload_archive
      WHERE
        upload_archive_id = ${uploadArchiveId};
    `;

    const response = await this.connection.sql(sqlStatement, UploadArchive);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Upload archive not found', ['UploadArchiveRepository->getUploadArchive', { uploadArchiveId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'UploadArchiveRepository->getUploadArchive',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all upload archives
   *
   * @returns {Promise<UploadArchive[]>} - A list of all upload archives.
   */
  async getUploadArchives(): Promise<UploadArchive[]> {
    const sqlStatement = SQL`
      SELECT
        upload_archive_id,
        upload_id,
        artifact_id,
        archive_status
      FROM
        upload_archive;
    `;

    const response = await this.connection.sql(sqlStatement, UploadArchive);
    return response.rows;
  }

  /**
   * Get all upload archives for a specific upload ID
   *
   * @param {string} uploadId - The ID of the upload to filter the archives.
   * @returns {Promise<UploadArchive[]>} - A list of all upload archives for the given upload ID.
   */
  async getUploadArchivesByUploadId(uploadId: string): Promise<UploadArchive[]> {
    const sqlStatement = SQL`
      SELECT
        upload_archive_id,
        upload_id,
        artifact_id,
        archive_status
      FROM
        upload_archive
      WHERE
        upload_id = ${uploadId};
    `;

    const response = await this.connection.sql(sqlStatement, UploadArchive);
    return response.rows;
  }

  /**
   * Get upload archive by artifact ID
   *
   * @param {string} artifactId - The ID of the artifact.
   * @returns {Promise<UploadArchive | null>} - The upload archive or null if not found.
   */
  async getUploadArchiveByArtifactId(artifactId: string): Promise<UploadArchive> {
    const sqlStatement = SQL`
      SELECT
        upload_archive_id,
        upload_id,
        artifact_id,
        archive_status
      FROM
        upload_archive
      WHERE
        artifact_id = ${artifactId};
    `;

    const response = await this.connection.sql(sqlStatement, UploadArchive);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Upload archive not found', [
        'UploadArchiveRepository->getUploadArchiveByArtifactId',
        { artifactId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'UploadArchiveRepository->getUploadArchiveByArtifactId',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert a new upload archive into the database.
   *
   * @param {CreateUploadArchive} uploadArchive - The upload archive data to insert.
   * @returns {Promise<{ upload_archive_id: string }>} - The inserted upload archive ID.
   * @throws {ApiExecuteSQLError} - Throws an error if the insertion fails.
   */
  async insertUploadArchive(uploadArchive: CreateUploadArchive): Promise<{ upload_archive_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO upload_archive (
        upload_id,
        artifact_id,
        archive_status
      ) VALUES (
        ${uploadArchive.upload_id},
        ${uploadArchive.artifact_id},
        ${uploadArchive.archive_status}
      )
      RETURNING upload_archive_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert upload archive record', [
        'UploadArchiveRepository->insertUploadArchive',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload archive in the database.
   *
   * @param {string} uploadArchiveId - The ID of the upload archive to update.
   * @param {UpdateUploadArchive} uploadArchive - The updated upload archive data.
   * @returns {Promise<{ upload_archive_id: string }>} - The updated upload archive ID.
   * @throws {ApiExecuteSQLError} - Throws an error if the update fails.
   */
  async updateUploadArchive(
    uploadArchiveId: string,
    uploadArchive: UpdateUploadArchive
  ): Promise<{ upload_archive_id: string }> {
    const sqlStatement = SQL`
      UPDATE upload_archive
      SET
        upload_id = COALESCE(${uploadArchive.upload_id}, upload_id),
        artifact_id = COALESCE(${uploadArchive.artifact_id}, artifact_id),
        archive_status = COALESCE(${uploadArchive.archive_status}, archive_status)
      WHERE
        upload_archive_id = ${uploadArchiveId}
      RETURNING upload_archive_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update upload archive record', [
        'UploadArchiveRepository->updateUploadArchive',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload archive in the database.
   *
   * @param {string} uploadId - The ID of the upload archive to update.
   * @param {UpdateUploadArchive} uploadArchive - The updated upload archive data.
   * @returns {Promise<{ upload_archive_id: string }[]>} - The updated upload archive ID.
   * @throws {ApiExecuteSQLError} - Throws an error if the update fails.
   */
  async updateUploadArchivesByUploadId(
    uploadId: string,
    uploadArchive: UpdateUploadArchive
  ): Promise<{ upload_archive_id: string }[]> {
    const sqlStatement = SQL`
      UPDATE upload_archive
      SET
        upload_id = COALESCE(${uploadArchive.upload_id}, upload_id),
        artifact_id = COALESCE(${uploadArchive.artifact_id}, artifact_id),
        archive_status = COALESCE(${uploadArchive.archive_status}, archive_status)
      WHERE
        upload_id = ${uploadId}
      RETURNING upload_archive_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to update upload archive record', [
        'UploadArchiveRepository->updateUploadArchive',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows;
  }

  /**
   * Delete an upload archive by its ID.
   *
   * @param {string} uploadArchiveId - The ID of the upload archive to delete.
   * @returns {Promise<void>} - Resolves with no value if the deletion succeeds.
   * @throws {ApiExecuteSQLError} - Throws an error if the deletion fails.
   */
  async deleteUploadArchive(uploadArchiveId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM upload_archive
      WHERE upload_archive_id = ${uploadArchiveId};
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete upload archive record', [
        'UploadArchiveRepository->deleteUploadArchive',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}

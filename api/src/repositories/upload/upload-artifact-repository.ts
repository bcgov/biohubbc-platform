import { SQL } from 'sql-template-strings';
import z from 'zod';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CreateUploadArtifact, UpdateUploadArtifact, UploadArtifact } from '../../models/upload-artifact';
import { BaseRepository } from '../base-repository';

export class UploadArtifactRepository extends BaseRepository {
  /**
   * Get a single upload artifact by ID
   *
   * @param {string} uploadArtifactId - The ID of the upload artifact to retrieve.
   * @returns {Promise<UploadArtifact>} - The upload artifact record.
   * @throws {ApiNotFoundError} - If the upload artifact is not found.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
   */
  async getUploadArtifact(uploadArtifactId: string): Promise<UploadArtifact> {
    const sqlStatement = SQL`
      SELECT
        upload_artifact_id,
        upload_id,
        artifact_id,
        role,
        upload_archive_id,
        path
      FROM
        upload_artifact
      WHERE
        upload_artifact_id = ${uploadArtifactId};
    `;

    const response = await this.connection.sql(sqlStatement, UploadArtifact);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Upload artifact not found', [
        'UploadArtifactRepository->getUploadArtifact',
        { uploadArtifactId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'UploadArtifactRepository->getUploadArtifact',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all upload artifacts
   *
   * @returns {Promise<UploadArtifact[]>} - A list of all upload artifacts.
   */
  async getUploadArtifacts(): Promise<UploadArtifact[]> {
    const sqlStatement = SQL`
      SELECT
        upload_artifact_id,
        upload_id,
        artifact_id,
        role,
        upload_archive_id,
        path
      FROM
        upload_artifact;
    `;

    const response = await this.connection.sql(sqlStatement, UploadArtifact);
    return response.rows;
  }

  /**
   * Insert a new upload artifact into the database.
   *
   * @param {CreateUploadArtifact} uploadArtifact - The upload artifact data to insert.
   * @returns {Promise<{ upload_artifact_id: string }>} - The inserted upload artifact ID.
   * @throws {ApiExecuteSQLError} - Throws an error if the insertion fails.
   */
  async insertUploadArtifact(uploadArtifact: CreateUploadArtifact): Promise<{ upload_artifact_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO upload_artifact (
        upload_id,
        artifact_id,
        role,
        upload_archive_id,
        path
      ) VALUES (
        ${uploadArtifact.upload_id},
        ${uploadArtifact.artifact_id},
        ${uploadArtifact.role},
        ${uploadArtifact.upload_archive_id},
        ${uploadArtifact.path ?? null}
      )
      ON CONFLICT DO NOTHING
      RETURNING upload_artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount === 1) {
      return response.rows[0];
    }

    const existing = await this.connection.sql(SQL`
      SELECT upload_artifact_id
      FROM upload_artifact
      WHERE upload_id = ${uploadArtifact.upload_id}
        AND artifact_id = ${uploadArtifact.artifact_id}
      LIMIT 1;
    `);

    if (existing.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert upload artifact record', [
        'UploadArtifactRepository->insertUploadArtifact',
        'Insert conflicted but existing row could not be resolved'
      ]);
    }

    return existing.rows[0];
  }

  /**
   * Insert upload artifact records in bulk.
   *
   * @param {CreateUploadArtifact[]} uploadArtifacts
   * @returns {Promise<{ upload_artifact_id: string }[]>}
   * @throws {ApiExecuteSQLError}
   */
  async insertUploadArtifacts(uploadArtifacts: CreateUploadArtifact[]): Promise<{ upload_artifact_id: string }[]> {
    if (!uploadArtifacts.length) {
      return [];
    }

    const uploadIds = uploadArtifacts.map((item) => item.upload_id);
    const artifactIds = uploadArtifacts.map((item) => item.artifact_id);
    const roles = uploadArtifacts.map((item) => item.role);
    const uploadArchiveIds = uploadArtifacts.map((item) => item.upload_archive_id);
    const paths = uploadArtifacts.map((item) => item.path ?? null);

    const sqlStatement = SQL`
      INSERT INTO upload_artifact (
        upload_id,
        artifact_id,
        role,
        upload_archive_id,
        path
      )
      SELECT *
      FROM UNNEST(
        ${uploadIds}::uuid[],
        ${artifactIds}::uuid[],
        ${roles}::upload_artifact_role[],
        ${uploadArchiveIds}::uuid[],
        ${paths}::text[]
      )
      ON CONFLICT DO NOTHING
      RETURNING upload_artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ upload_artifact_id: z.string().uuid() }));

    return response.rows;
  }

  /**
   * Update an existing upload artifact in the database.
   *
   * @param {string} uploadArtifactId - The ID of the upload artifact to update.
   * @param {UpdateUploadArtifact} uploadArtifact - The updated upload artifact data.
   * @returns {Promise<{ upload_artifact_id: string }>} - The updated upload artifact ID.
   * @throws {ApiExecuteSQLError} - Throws an error if the update fails.
   */
  async updateUploadArtifact(
    uploadArtifactId: string,
    uploadArtifact: UpdateUploadArtifact
  ): Promise<{ upload_artifact_id: string }> {
    const sqlStatement = SQL`
      UPDATE upload_artifact
      SET
        upload_id = COALESCE(${uploadArtifact.upload_id}, upload_id),
        artifact_id = COALESCE(${uploadArtifact.artifact_id}, artifact_id),
        role = COALESCE(${uploadArtifact.role}, role),
        upload_archive_id = COALESCE(${uploadArtifact.upload_archive_id}, upload_archive_id),
        path = COALESCE(${uploadArtifact.path ?? null}, path)
      WHERE
        upload_artifact_id = ${uploadArtifactId}
      RETURNING upload_artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update upload artifact record', [
        'UploadArtifactRepository->updateUploadArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Delete an upload artifact by its ID.
   *
   * @param {string} uploadArtifactId - The ID of the upload artifact to delete.
   * @returns {Promise<void>} - Resolves with no value if the deletion succeeds.
   * @throws {ApiExecuteSQLError} - Throws an error if the deletion fails.
   */
  async deleteUploadArtifact(uploadArtifactId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM upload_artifact
      WHERE upload_artifact_id = ${uploadArtifactId};
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete upload artifact record', [
        'UploadArtifactRepository->deleteUploadArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}

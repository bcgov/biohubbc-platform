import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { ArtifactReferenceResolution } from '../../models/submission-feature-property-index';
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
        upload_archive_id
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
        upload_archive_id
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
        upload_archive_id
      ) VALUES (
        ${uploadArtifact.upload_id},
        ${uploadArtifact.artifact_id},
        ${uploadArtifact.role},
        ${uploadArtifact.upload_archive_id}
      )
      RETURNING upload_artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert upload artifact record', [
        'UploadArtifactRepository->insertUploadArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
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
        upload_archive_id = COALESCE(${uploadArtifact.upload_archive_id}, upload_archive_id)
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

  /**
   * Resolve artifact references to artifact IDs for feature artifacts under one submission upload.
   *
   * @param {string} submissionUploadId
   * @param {string[]} references
   * @return {Promise<ArtifactReferenceResolution[]>}
   * @memberof UploadArtifactRepository
   */
  async getFeatureArtifactResolutionsBySubmissionUploadIdAndReferences(
    submissionUploadId: string,
    references: string[]
  ): Promise<ArtifactReferenceResolution[]> {
    if (!references.length) {
      return [];
    }

    const sqlStatement = SQL`
      WITH normalized_refs AS (
        SELECT DISTINCT
          refs.reference,
          CASE
            WHEN refs.reference LIKE 'files/%' THEN substr(refs.reference, 7)
            ELSE refs.reference
          END AS normalized_reference
        FROM unnest(${references}::text[]) AS refs(reference)
      )
      SELECT
        normalized_refs.reference AS artifact_reference,
        artifact.artifact_id
      FROM normalized_refs
      INNER JOIN submission_upload
        ON submission_upload.submission_upload_id = ${submissionUploadId}
      INNER JOIN upload_artifact
        ON upload_artifact.upload_id = submission_upload.upload_id
       AND upload_artifact.role = 'feature'
      INNER JOIN artifact
        ON artifact.artifact_id = upload_artifact.artifact_id
      WHERE
        artifact.object_key = normalized_refs.reference
        OR artifact.object_key = normalized_refs.normalized_reference
        OR substring(artifact.object_key FROM '[^/]+$') = normalized_refs.normalized_reference;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactReferenceResolution);
    return response.rows;
  }
}

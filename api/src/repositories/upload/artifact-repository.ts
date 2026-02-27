import { SQL } from 'sql-template-strings';
import z from 'zod';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { Artifact, CreateArtifact, UpdateArtifact } from '../../models/artifact';
import { BaseRepository } from '../base-repository';

export class ArtifactRepository extends BaseRepository {
  /**
   * Get a single artifact by ID.
   *
   * @param {string} artifactId - The ID of the artifact to retrieve.
   * @returns {Promise<Artifact>} - The artifact record.
   * @throws {ApiExecuteSQLError} - If the artifact is not found or query fails.
   */
  async getArtifact(artifactId: string): Promise<Artifact> {
    const sqlStatement = SQL`
      SELECT
        artifact_id,
        artifact_status,
        bucket,
        object_key,
        byte_size,
        checksum_sha256,
        uploaded_at
      FROM
        artifact
      WHERE
        artifact_id = ${artifactId};
    `;

    const response = await this.connection.sql(sqlStatement, Artifact);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Artifact not found', ['ArtifactRepository->getArtifact', { artifactId }]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ArtifactRepository->getArtifact',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all artifact records.
   *
   * @returns {Promise<Artifact[]>} - Array of all artifact records.
   * @throws {ApiExecuteSQLError} - If the query fails.
   */
  async getArtifacts(): Promise<Artifact[]> {
    const sqlStatement = SQL`
      SELECT
        artifact_id,
        artifact_status,
        bucket,
        object_key,
        byte_size,
        checksum_sha256,
        uploaded_at
      FROM
        artifact;
    `;

    const response = await this.connection.sql(sqlStatement, Artifact);

    return response.rows;
  }

  /**
   * Insert a new artifact record.
   *
   * @param {CreateArtifact} artifact - The artifact data to insert.
   * @returns {Promise<{ artifact_id: string }>} - The newly created artifact ID.
   * @throws {ApiExecuteSQLError} - If the insert fails.
   */
  async insertArtifact(artifact: CreateArtifact): Promise<{ artifact_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO artifact (
        bucket,
        object_key,
        byte_size,
        artifact_status,
        checksum_sha256,
        uploaded_at
      ) VALUES (
        ${artifact.bucket},
        ${artifact.object_key},
        ${artifact.byte_size ?? null},
        ${artifact.artifact_status},
        ${artifact.checksum_sha256 ?? null},
        ${artifact.uploaded_at ?? null}
      )
      ON CONFLICT (bucket, object_key) DO NOTHING;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount === 1) {
      return response.rows[0];
    }

    // Conflict: return existing artifact_id
    const existing = await this.connection.sql(SQL`
      SELECT artifact_id FROM artifact WHERE bucket = ${artifact.bucket} AND object_key = ${artifact.object_key};
    `);

    return existing.rows[0];
  }

  /**
   * Update a single artifact record by ID.
   *
   * @param {string} artifactId - The ID of the artifact to update.
   * @param {UpdateArtifact} artifact - The artifact fields to update.
   * @returns {Promise<{ artifact_id: string }>} - The updated artifact ID.
   * @throws {ApiExecuteSQLError} - If the update fails or no row is updated.
   */
  async updateArtifact(artifactId: string, artifact: UpdateArtifact): Promise<{ artifact_id: string }> {
    const sqlStatement = SQL`
      UPDATE artifact
      SET
        bucket = COALESCE(${artifact.bucket}, bucket),
        artifact_status = COALESCE(${artifact.artifact_status}, artifact_status),
        object_key = COALESCE(${artifact.object_key}, object_key),
        byte_size = COALESCE(${artifact.byte_size}, byte_size),
        checksum_sha256 = COALESCE(${artifact.checksum_sha256}, checksum_sha256),
        uploaded_at = COALESCE(${artifact.uploaded_at}, uploaded_at)
      WHERE
        artifact_id = ${artifactId}
      RETURNING artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update artifact record', [
        'ArtifactRepository->updateArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update artifact records linked to a given upload ID.
   *
   * @param {string} uploadId - The upload ID linking to artifacts.
   * @param {UpdateArtifact} artifact - The artifact fields to update.
   * @returns {Promise<{artifact_id: string}[]>} - The updated artifact records.
   * @throws {ApiExecuteSQLError} - If the update fails or no row is updated.
   */
  async updateArtifactsByUploadId(uploadId: string, artifact: UpdateArtifact): Promise<{ artifact_id: string }[]> {
    const sqlStatement = SQL`
      UPDATE artifact AS a
      SET artifact_status = COALESCE(${artifact.artifact_status ?? null}, a.artifact_status),
          uploaded_at = COALESCE(${artifact.uploaded_at}, a.uploaded_at)
      FROM upload_archive AS ua
      JOIN upload AS u ON ua.upload_id = u.upload_id
      WHERE a.artifact_id = ua.artifact_id
        AND u.upload_id = ${uploadId}
      RETURNING a.artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ artifact_id: z.string().uuid() }));

    if (!response.rowCount) {
      throw new ApiExecuteSQLError('Failed to update artifact record', [
        'ArtifactRepository->updateArtifactsByUploadId',
        `rowCount was ${response.rowCount}, expected > 0`
      ]);
    }

    return response.rows;
  }

  /**
   * Delete an artifact by ID.
   *
   * @param {string} artifactId - The ID of the artifact to delete.
   * @returns {Promise<void>} - Resolves if deletion succeeds.
   * @throws {ApiExecuteSQLError} - If deletion fails or no row is deleted.
   */
  async deleteArtifact(artifactId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM artifact
      WHERE artifact_id = ${artifactId}
      RETURNING artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ artifact_id: z.string().uuid() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to delete artifact record', [
        'ArtifactRepository->deleteArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }
  }
}

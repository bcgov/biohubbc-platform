import { SQL } from 'sql-template-strings';
import z from 'zod';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { Artifact, BatchUpdateArtifact, CreateArtifact, UpdateArtifact } from '../../models/artifact';
import { BaseRepository } from '../base-repository';

export class ArtifactRepository extends BaseRepository {
  /**
   * Insert artifact records in bulk without mutating existing rows and return
   * the persisted records for all input keys.
   *
   * @param {CreateArtifact[]} artifacts
   * @returns {Promise<Artifact[]>}
   */
  async insertArtifacts(artifacts: CreateArtifact[]): Promise<Artifact[]> {
    if (!artifacts.length) {
      return [];
    }

    const buckets = artifacts.map((artifact) => artifact.bucket);
    const artifactStatuses = artifacts.map((artifact) => artifact.artifact_status);
    const objectKeys = artifacts.map((artifact) => artifact.object_key);
    const byteSizes = artifacts.map((artifact) => artifact.byte_size);
    const checksums = artifacts.map((artifact) => artifact.checksum_sha256 ?? null);
    const uploadedAts = artifacts.map((artifact) => artifact.uploaded_at ?? null);
    const formats = artifacts.map((artifact) => artifact.format);

    const sqlStatement = SQL`
      INSERT INTO artifact (
        bucket,
        object_key,
        byte_size,
        artifact_status,
        checksum_sha256,
        uploaded_at,
        format
      )
      SELECT *
      FROM UNNEST(
        ${buckets}::text[],
        ${objectKeys}::text[],
        ${byteSizes}::bigint[],
        ${artifactStatuses}::artifact_status[],
        ${checksums}::text[],
        ${uploadedAts}::timestamptz[],
        ${formats}::text[]
      ) AS t(
        bucket,
        object_key,
        byte_size,
        artifact_status,
        checksum_sha256,
        uploaded_at,
        format
      )
      ON CONFLICT (bucket, object_key) DO UPDATE
      SET
        bucket = artifact.bucket
      RETURNING
        artifact_id,
        artifact_status,
        bucket,
        object_key,
        byte_size,
        checksum_sha256,
        uploaded_at,
        format;
    `;

    const response = await this.connection.sql(sqlStatement, Artifact);

    return response.rows;
  }

  /**
   * Get a single artifact by ID.
   *
   * @param {string} artifactId - The ID of the artifact to retrieve.
   * @returns {Promise<Artifact>} - The artifact record.
   * @throws {ApiNotFoundError} - If the artifact is not found.
   * @throws {ApiExecuteSQLError} - If an unexpected row count is returned.
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
        uploaded_at,
        format
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
        uploaded_at,
        format
      FROM
        artifact;
    `;

    const response = await this.connection.sql(sqlStatement, Artifact);

    return response.rows;
  }

  /**
   * Insert or resolve a single artifact by key and return the persisted row in
   * one statement.
   *
   * @param {CreateArtifact} artifact
   * @returns {Promise<Artifact>}
   */
  async insertArtifact(artifact: CreateArtifact): Promise<Artifact> {
    const sqlStatement = SQL`
      INSERT INTO artifact (
        bucket,
        object_key,
        byte_size,
        artifact_status,
        checksum_sha256,
        uploaded_at,
        format
      )
      VALUES (
        ${artifact.bucket}::text,
        ${artifact.object_key}::text,
        ${artifact.byte_size ?? null}::bigint,
        ${artifact.artifact_status}::artifact_status,
        ${artifact.checksum_sha256 ?? null}::text,
        ${artifact.uploaded_at ?? null}::timestamptz,
        ${artifact.format}::text
      )
      ON CONFLICT (bucket, object_key) DO UPDATE
      SET
        bucket = artifact.bucket
      RETURNING
        artifact_id,
        artifact_status,
        bucket,
        object_key,
        byte_size,
        checksum_sha256,
        uploaded_at,
        format;
    `;

    const response = await this.connection.sql(sqlStatement, Artifact);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert artifact record', [
        'ArtifactRepository->insertArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
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
        uploaded_at = COALESCE(${artifact.uploaded_at}, uploaded_at),
        format = COALESCE(${artifact.format}, format)
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
   * Update multiple artifacts by id in one statement.
   *
   * @param {BatchUpdateArtifact[]} artifacts - Row-level updates keyed by artifact id.
   * @returns {Promise<{ artifact_id: string }[]>}
   * @throws {ApiExecuteSQLError}
   */
  async updateArtifactsByIds(artifacts: BatchUpdateArtifact[]): Promise<{ artifact_id: string }[]> {
    if (!artifacts.length) {
      return [];
    }

    const artifactIds = artifacts.map((artifact) => artifact.artifact_id);
    const artifactStatuses = artifacts.map((artifact) => artifact.artifact_status ?? null);
    const checksums = artifacts.map((artifact) => artifact.checksum_sha256 ?? null);
    const uploadedAts = artifacts.map((artifact) => artifact.uploaded_at ?? null);

    const sqlStatement = SQL`
      UPDATE artifact AS a
      SET
        artifact_status = COALESCE(u.artifact_status::artifact_status, a.artifact_status),
        checksum_sha256 = COALESCE(u.checksum_sha256, a.checksum_sha256),
        uploaded_at = COALESCE(u.uploaded_at::timestamptz, a.uploaded_at)
      FROM (
        SELECT *
        FROM UNNEST(
          ${artifactIds}::uuid[],
          ${artifactStatuses}::text[],
          ${checksums}::text[],
          ${uploadedAts}::text[]
        ) AS t(artifact_id, artifact_status, checksum_sha256, uploaded_at)
      ) AS u
      WHERE a.artifact_id = u.artifact_id
      RETURNING a.artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ artifact_id: z.string().uuid() }));

    if (response.rowCount !== artifacts.length) {
      throw new ApiExecuteSQLError('Failed to update artifact records', [
        'ArtifactRepository->updateArtifactsByIds',
        `rowCount was ${response.rowCount}, expected ${artifacts.length}`
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

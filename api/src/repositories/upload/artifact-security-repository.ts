import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { BaseRepository } from '../base-repository';

export class ArtifactSecurityRepository extends BaseRepository {
  /**
   * Find the most recent active security record for an artifact.
   *
   * @param {string} artifactId - Artifact UUID.
   * @returns {Promise<ArtifactSecurity | null>} Latest active security row, or null when absent.
   * @memberof ArtifactSecurityRepository
   */
  async findLatestArtifactSecurityByArtifactId(artifactId: string): Promise<ArtifactSecurity | null> {
    const sqlStatement = SQL`
      SELECT
        artifact_security_id,
        artifact_id,
        security
      FROM
        artifact_security
      WHERE
        artifact_id = ${artifactId}
        AND record_end_date IS NULL
      ORDER BY
        create_date DESC
      LIMIT 1;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    if (!response.rowCount) {
      return null;
    }

    return response.rows[0];
  }

  /**
   * Get a security record by ID.
   *
   * @param {string} uploadArtifactSecurityId
   * @return {Promise<ArtifactSecurity>}
   */
  async getArtifactSecurity(uploadArtifactSecurityId: string): Promise<ArtifactSecurity> {
    const sqlStatement = SQL`
      SELECT
        artifact_security_id,
        artifact_id,
        security
      FROM
        artifact_security
      WHERE
        artifact_security_id = ${uploadArtifactSecurityId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Artifact security record not found', [
        'ArtifactSecurityRepository->getArtifactSecurity',
        { uploadArtifactSecurityId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'ArtifactSecurityRepository->getArtifactSecurity',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all security records.
   *
   * @return {Promise<ArtifactSecurity[]>}
   */
  async getArtifactSecuritys(): Promise<ArtifactSecurity[]> {
    const sqlStatement = SQL`
    SELECT
      artifact_security_id,
      artifact_id,
      security
    FROM
      artifact_security;
  `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    return response.rows;
  }

  /**
   * Insert a new upload artifact security record.
   *
   * @param {CreateArtifactSecurity} security
   * @return {Promise<ArtifactSecurity>}
   */
  async insertArtifactSecurity(security: CreateArtifactSecurity): Promise<ArtifactSecurity> {
    const sqlStatement = SQL`
      INSERT INTO artifact_security (
        artifact_id,
        security
      ) VALUES (
        ${security.artifact_id},
        ${security.security}
      )
      RETURNING 
        artifact_security_id,
        artifact_id,
        security;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security record', [
        'ArtifactSecurityRepository->insertArtifactSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Insert artifact security records for all artifacts associated with an upload.
   *
   * @param {string} uploadId The upload session ID
   * @param {Omit<CreateArtifactSecurity, 'artifact_id'>} security The security data
   * @return {Promise<ArtifactSecurity[]>}
   */
  async insertArtifactSecurityByUploadId(
    uploadId: string,
    security: Omit<CreateArtifactSecurity, 'artifact_id'>
  ): Promise<ArtifactSecurity[]> {
    const sqlStatement = SQL`
    INSERT INTO artifact_security (
      artifact_id,
      security
    )
    SELECT ua.artifact_id, ${security.security}
    FROM upload_archive AS ua
    WHERE ua.upload_id = ${uploadId}
    RETURNING 
      artifact_security_id,
      artifact_id,
      security;
  `;
    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);
    if (response.rowCount === 0) {
      throw new ApiExecuteSQLError('Failed to insert security records', [
        'ArtifactSecurityRepository->insertArtifactSecurityByUploadId',
        'rowCount was 0, expected at least 1 record'
      ]);
    }
    return response.rows;
  }

  /**
   * Update an existing upload artifact security record.
   *
   * @param {string} uploadArtifactSecurityId
   * @param {UpdateArtifactSecurity} security
   * @return {Promise<ArtifactSecurity>}
   */
  async updateArtifactSecurity(
    uploadArtifactSecurityId: string,
    security: UpdateArtifactSecurity
  ): Promise<ArtifactSecurity> {
    const sqlStatement = SQL`
      UPDATE artifact_security
      SET
        security = COALESCE(${security.security}, security),
        artifact_id = COALESCE(${security.artifact_id}, artifact_id),
        record_end_date = COALESCE(${security.record_end_date}, record_end_date)
      WHERE
        artifact_security_id = ${uploadArtifactSecurityId}
      RETURNING
        artifact_security_id,
        artifact_id,
        security;
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update security record', [
        'ArtifactSecurityRepository->updateArtifactSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}

import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { BaseRepository } from '../base-repository';

export class ArtifactSecurityRepository extends BaseRepository {
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
        status
      FROM
        biohub.artifact_security
      WHERE
        artifact_security_id = ${uploadArtifactSecurityId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get security record', [
        'ArtifactSecurityRepository->getArtifactSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
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
      status
    FROM
      biohub.artifact_security;
  `;

    const response = await this.connection.sql(sqlStatement, ArtifactSecurity);

    return response.rows;
  }

  /**
   * Insert a new upload artifact security record.
   *
   * @param {CreateArtifactSecurity} security
   * @return {Promise<{ security_id: string }>}
   */
  async insertArtifactSecurity(security: CreateArtifactSecurity): Promise<{ security_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_security (
        artifact_id,
        status
      ) VALUES (
        ${security.artifact_id},
        ${security.security}
      )
      RETURNING artifact_security_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert security record', [
        'ArtifactSecurityRepository->insertArtifactSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload artifact security record.
   *
   * @param {string} uploadArtifactSecurityId
   * @param {UpdateArtifactSecurity} security
   * @return {Promise<{ security_id: string }>}
   */
  async updateArtifactSecurity(
    uploadArtifactSecurityId: string,
    security: UpdateArtifactSecurity
  ): Promise<{ security_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_security
      SET
        status = COALESCE(${security.security}, status),
        artifact_id = COALESCE(${security.artifact_id}, artifact_id)
      WHERE
        artifact_security_id = ${uploadArtifactSecurityId}
      RETURNING artifact_security_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update security record', [
        'ArtifactSecurityRepository->updateArtifactSecurity',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}

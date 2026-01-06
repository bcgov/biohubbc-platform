import { SQL } from 'sql-template-strings';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactQuarantine,
  CreateArtifactQuarantine,
  UpdateArtifactQuarantine
} from '../../models/artifact-quarantine';
import { BaseRepository } from '../base-repository';

export class ArtifactQuarantineRepository extends BaseRepository {
  /**
   * Get a quarantine record by ID.
   *
   * @param {string} uploadArtifactQuarantineId
   * @return {Promise<ArtifactQuarantine>}
   */
  async getArtifactQuarantine(uploadArtifactQuarantineId: string): Promise<ArtifactQuarantine> {
    const sqlStatement = SQL`
      SELECT
        artifact_quarantine_id,
        upload_artifact_id,
        status
      FROM
        biohub.artifact_quarantine
      WHERE
        artifact_quarantine_id = ${uploadArtifactQuarantineId};
    `;

    const response = await this.connection.sql(sqlStatement, ArtifactQuarantine);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to get quarantine record', [
        'ArtifactQuarantineRepository->getArtifactQuarantine',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all quarantine records.
   *
   * @return {Promise<ArtifactQuarantine[]>}
   */
  async getArtifactQuarantines(): Promise<ArtifactQuarantine[]> {
    const sqlStatement = SQL`
    SELECT
      artifact_quarantine_id,
      upload_artifact_id,
      status
    FROM
      biohub.artifact_quarantine;
  `;

    const response = await this.connection.sql(sqlStatement, ArtifactQuarantine);

    return response.rows;
  }

  /**
   * Insert a new upload artifact quarantine record.
   *
   * @param {CreateArtifactQuarantine} quarantine
   * @return {Promise<{ quarantine_id: string }>}
   */
  async insertArtifactQuarantine(quarantine: CreateArtifactQuarantine): Promise<{ quarantine_id: string }> {
    const sqlStatement = SQL`
      INSERT INTO biohub.artifact_quarantine (
        upload_artifact_id,
        status
      ) VALUES (
        ${quarantine.upload_artifact_id},
        ${quarantine.status}
      )
      RETURNING artifact_quarantine_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert quarantine record', [
        'ArtifactQuarantineRepository->insertArtifactQuarantine',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Update an existing upload artifact quarantine record.
   *
   * @param {string} uploadArtifactQuarantineId
   * @param {UpdateArtifactQuarantine} quarantine
   * @return {Promise<{ quarantine_id: string }>}
   */
  async updateArtifactQuarantine(
    uploadArtifactQuarantineId: string,
    quarantine: UpdateArtifactQuarantine
  ): Promise<{ quarantine_id: string }> {
    const sqlStatement = SQL`
      UPDATE biohub.artifact_quarantine
      SET
        status = COALESCE(${quarantine.status}, status),
        upload_artifact_id = COALESCE(${quarantine.upload_artifact_id}, upload_artifact_id)
      WHERE
        artifact_quarantine_id = ${uploadArtifactQuarantineId}
      RETURNING artifact_quarantine_id;
    `;

    const response = await this.connection.sql(sqlStatement);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to update quarantine record', [
        'ArtifactQuarantineRepository->updateArtifactQuarantine',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }
}

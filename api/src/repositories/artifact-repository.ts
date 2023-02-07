import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('repositories/artifact-repository');

export interface IArtifactMetadata {
  file_name: string;
  file_type: string;
  title?: string;
  description?: string;
  file_size?: number;
}
export interface IArtifact extends IArtifactMetadata {
  artifact_id: number;
  submission_id: number;
  uuid: string;
  input_key: string;
  foi_reason_description?: string;
}

export class ArtifactRepository extends BaseRepository {
  /**
   * 
   * @param count 
   * @returns 
   * @memberof ArtifactRepository
   */
  async getNextArtifactIds(count: number): Promise<number[]> {
    defaultLog.debug({ label: 'getNextArtifactIds' });

    const sqlStatement = SQL`
      SELECT
        NEXTVAL('artifact_seq') AS artifact_id
      FROM
        GENERATE_SERIES(1, ${count});
    `

    const response = await this.connection.sql<{ artifact_id: number }>(sqlStatement);

    const results = (response && response.rowCount && response.rows) || null;

    if (!results) {
      throw new ApiExecuteSQLError('Failed to get next artifact ID');
    }

    return results.map((row) => row.artifact_id);
  }

  async insertArtifactRecord(artifact: IArtifact): Promise<{ artifact_id: number }> {
    defaultLog.debug({ label: 'insertArtifactRecord', artifact });

    const sqlStatement = SQL`
      INSERT INTO
        artifact
      (
        artifact_id,
        submission_id,
        uuid,
        input_key,
        file_name,
        file_type,
        title,
        description,
        file_size,
      ) VALUES (
        ${artifact.artifact_id},
        ${artifact.submission_id},
        ${artifact.uuid},
        ${artifact.input_key}
        ${artifact.file_name},
        ${artifact.file_type},
        ${artifact.title},
        ${artifact.description},
        ${artifact.file_size},
      )
      RETURNING
        artifact_id;
    `;

    const response = await this.connection.sql<{ artifact_id: number }>(sqlStatement);

    const result = (response && response.rowCount && response.rows[0]) || null;

    if (!result) {
      throw new ApiExecuteSQLError('Failed to insert artifact metadata');
    }

    return result;
  }
}

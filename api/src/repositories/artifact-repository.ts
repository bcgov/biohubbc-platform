import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { BaseRepository } from './base-repository';
import { getLogger } from '../utils/logger';

const defaultLog = getLogger('repositories/artifact-repository');

export interface IArtifactMetadata {
  title?: string;
  description?: string;
  file_size?: number;
  foi_reason_description?: string;
}
export interface IGetArtifactMetadata extends IArtifactMetadata {
  artifact_id: number;
  submission_id: number;
  uuid: string;
  file_name: string;
  file_type: string;
}

export class ArtifactRepository extends BaseRepository {
  async getNextArtifactId(): Promise<number> {
    defaultLog.debug({ label: 'getNextArtifactId' });

    const sqlStatement = SQL`
      SELECT
        NEXTVAL('artifact_seq')
      AS
        artifact_id
    `

    const response = await this.connection.sql<{ artifact_id: number }>(sqlStatement);

    const result = (response && response.rowCount && response.rows[0]?.artifact_id) || null;

    if (!result) {
      throw new ApiExecuteSQLError('Failed to get next artifact ID');
    }

    return result;
  }

  async insertArtifactMetadata(artifactMetadata: IGetArtifactMetadata): Promise<{ artifact_id: number }> {
    defaultLog.debug({ label: 'insertArtifactMetadata', artifactMetadata });

    const sqlStatement = SQL`
      INSERT INTO
        artifact
      (
        artifact_id,
        submission_id,
        uuid,
        file_name,
        file_type,
        title,
        description,
        file_size,
        foi_reason_description
      ) VALUES (
        ${artifactMetadata?.artifact_id},
        ${artifactMetadata?.submission_id},
        ${artifactMetadata?.uuid},
        ${artifactMetadata?.file_name},
        ${artifactMetadata?.file_type},
        ${artifactMetadata?.title},
        ${artifactMetadata?.description},
        ${artifactMetadata?.file_size},
        ${artifactMetadata?.foi_reason_description}
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

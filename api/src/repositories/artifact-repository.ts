import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { getLogger } from '../utils/logger';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/artifact-repository');

export const ArtifactMetadata = z.object({
  file_name: z.string(),
  file_type: z.string(),
  file_size: z.number(),
  title: z.string().nullable(),
  description: z.string().nullable()
});

export type ArtifactMetadata = z.infer<typeof ArtifactMetadata>;

export const Artifact = ArtifactMetadata.extend({
  artifact_id: z.number(),
  submission_id: z.number(),
  uuid: z.string().uuid(),
  key: z.string(),
  foi_reason_description: z.string().nullable().optional(),
  security_review_timestamp: z.date().nullable().optional(),
  create_date: z.date().optional()
});

export type Artifact = z.infer<typeof Artifact>;

/**
 * A repository for maintaining submission artifacts.
 *
 * @export
 * @class ArtifactRepository
 * @extends BaseRepository
 */
export class ArtifactRepository extends BaseRepository {
  /**
   * Retrieves an array of of new primary keys for an artifact record.
   *
   * @param {number} [count=1] The number of artifact primary keys to generate (by default, only 1).
   * @returns {*} {Promise<number[]>} The array of artifact primary keys
   * @memberof ArtifactRepository
   */
  async getNextArtifactIds(count: number): Promise<number[]> {
    defaultLog.debug({ label: 'getNextArtifactIds' });

    const sqlStatement = SQL`
      SELECT
        NEXTVAL('artifact_seq')::integer AS artifact_id
      FROM
        GENERATE_SERIES(1, ${count});
    `;

    const response = await this.connection.sql(sqlStatement, Artifact.pick({ artifact_id: true }));

    const results = (response && response.rowCount && response.rows) || null;

    if (!results) {
      throw new ApiExecuteSQLError('Failed to get next artifact IDs');
    }

    return results.map((row) => row.artifact_id);
  }

  /**
   * Inserts a new artifact record
   *
   * @param artifact The artifact record to insert
   * @returns {*} {Promise<{ artifact_id: number }>} The ID of the inserted artifact
   * @memberof ArtifactRepository
   */
  async insertArtifactRecord(artifact: Artifact): Promise<{ artifact_id: number }> {
    defaultLog.debug({ label: 'insertArtifactRecord', artifact });

    const sqlStatement = SQL`
      INSERT INTO
        artifact
      (
        artifact_id,
        submission_id,
        uuid,
        key,
        file_name,
        file_type,
        title,
        description,
        file_size
      ) VALUES (
        ${artifact.artifact_id},
        ${artifact.submission_id},
        ${artifact.uuid},
        ${artifact.key},
        ${artifact.file_name},
        ${artifact.file_type},
        ${artifact.title},
        ${artifact.description},
        ${artifact.file_size}
      )
      RETURNING
        artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, Artifact.pick({ artifact_id: true }));

    const result = (response && response.rowCount && response.rows[0]) || null;

    if (!result) {
      throw new ApiExecuteSQLError('Failed to insert artifact record');
    }

    return result;
  }

  /**
   * Retrieves all artifacts belonging to the given dataset.
   *
   * @param {string} datasetId The ID of the dataset
   * @return {*}  {Promise<IArtifact[]>} All artifacts associated with the dataset
   * @memberof ArtifactRepository
   */
  async getArtifactsByDatasetId(datasetId: string): Promise<Artifact[]> {
    defaultLog.debug({ label: 'getArtifactsByDatasetId', datasetId });

    const sqlStatement = SQL`
    SELECT
      a.*
    FROM
      artifact a
    WHERE
      a.submission_id
    IN (
      SELECT
        sm.submission_id
      FROM
        submission s,
        submission_metadata sm
      WHERE
        s.submission_id = sm.submission_id
      AND
        sm.record_end_timestamp IS NULL
      AND
        s.uuid = ${datasetId}
    );`;

    const response = await this.connection.sql<Artifact>(sqlStatement, Artifact);

    return response.rows;
  }

  async getArtifactById(artifactId: number): Promise<Artifact> {
    defaultLog.debug({ label: 'getArtifactById', artifactId });

    const sqlStatement = SQL`
      SELECT
        a.*
      FROM
        artifact a
      WHERE
        a.artifact_id = ${artifactId};
    `;

    const response = await this.connection.sql<Artifact>(sqlStatement, Artifact);

    const result = (response && response.rowCount && response.rows[0]) || null;

    if (!result) {
      throw new ApiExecuteSQLError('Failed to retreive artifact record by ID');
    }

    return result;
  }
}

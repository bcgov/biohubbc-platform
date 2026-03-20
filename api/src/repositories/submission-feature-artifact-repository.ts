import SQL from 'sql-template-strings';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateSubmissionFeatureArtifact, SubmissionFeatureArtifact } from '../models/submission-feature-artifact';
import { BaseRepository } from './base-repository';

export class SubmissionFeatureArtifactRepository extends BaseRepository {
  /**
   * Get submission_feature_artifact rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeatureArtifact[]>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async getSubmissionFeatureArtifactsBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeatureArtifact[]> {
    const sqlStatement = SQL`
      SELECT
        submission_feature_artifact_id,
        submission_feature_id,
        artifact_id
      FROM submission_feature_artifact
      WHERE
        submission_feature_id = ${submissionFeatureId}
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureArtifact);
    return response.rows;
  }

  /**
   * Get submission_feature_artifact rows by artifact id.
   *
   * @param {string} artifactId
   * @return {Promise<SubmissionFeatureArtifact[]>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async getSubmissionFeatureArtifactsByArtifactId(artifactId: string): Promise<SubmissionFeatureArtifact[]> {
    const sqlStatement = SQL`
      SELECT
        submission_feature_artifact_id,
        submission_feature_id,
        artifact_id
      FROM submission_feature_artifact
      WHERE
        artifact_id = ${artifactId}::uuid
        AND record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureArtifact);
    return response.rows;
  }

  /**
   * Bulk insert submission_feature_artifact rows.
   *
   * @param {CreateSubmissionFeatureArtifact[]} payloads
   * @return {Promise<SubmissionFeatureArtifact[]>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async insertSubmissionFeatureArtifacts(
    payloads: CreateSubmissionFeatureArtifact[]
  ): Promise<SubmissionFeatureArtifact[]> {
    if (!payloads.length) {
      return [];
    }

    const sqlStatement = SQL`
      INSERT INTO submission_feature_artifact (
        submission_feature_id,
        artifact_id
      )
      SELECT
        staged.submission_feature_id,
        staged.artifact_id
      FROM unnest(
        ${payloads.map((payload) => payload.submission_feature_id)}::integer[],
        ${payloads.map((payload) => payload.artifact_id)}::uuid[]
      ) AS staged(submission_feature_id, artifact_id)
      RETURNING
        submission_feature_artifact_id,
        submission_feature_id,
        artifact_id;
    `;

    const response = await this.connection.sql(sqlStatement, SubmissionFeatureArtifact);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_artifact rows', [
        'SubmissionFeatureArtifactRepository->insertSubmissionFeatureArtifacts',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Delete submission_feature_artifact rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async deleteSubmissionFeatureArtifactsBySubmissionId(submissionId: number): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature_artifact
      WHERE submission_feature_id IN (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_id = ${submissionId}
      );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Delete submission_feature_artifact rows for a submission upload attempt.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async deleteSubmissionFeatureArtifactsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      DELETE FROM submission_feature_artifact
      WHERE submission_feature_id IN (
        SELECT submission_feature_id
        FROM submission_feature
        WHERE submission_upload_id = ${submissionUploadId}
      );
    `;

    await this.connection.sql(sqlStatement);
  }
}

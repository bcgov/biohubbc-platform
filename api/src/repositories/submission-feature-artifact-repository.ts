import SQL from 'sql-template-strings';
import z from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { CreateSubmissionFeatureArtifact } from '../models/submission-feature-artifact';
import { BaseRepository } from './base-repository';

export class SubmissionFeatureArtifactRepository extends BaseRepository {
  /**
   * Bulk insert explicit submission_feature -> artifact links.
   *
   * @param {CreateSubmissionFeatureArtifact[]} submissionFeatureArtifacts
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async insertSubmissionFeatureArtifacts(submissionFeatureArtifacts: CreateSubmissionFeatureArtifact[]): Promise<void> {
    if (!submissionFeatureArtifacts.length) {
      return;
    }

    const sqlStatement = SQL`
      INSERT INTO submission_feature_artifact (
        submission_feature_id,
        artifact_id
      ) VALUES
    `;

    for (let i = 0; i < submissionFeatureArtifacts.length; i++) {
      const item = submissionFeatureArtifacts[i];
      if (i > 0) {
        sqlStatement.append(SQL`,`);
      }
      sqlStatement.append(SQL`(${item.submission_feature_id}, ${item.artifact_id})`);
    }

    sqlStatement.append(SQL`
      RETURNING submission_feature_artifact_id;
    `);

    const response = await this.connection.sql(sqlStatement, z.object({ submission_feature_artifact_id: z.number() }));

    if (response.rowCount !== submissionFeatureArtifacts.length) {
      throw new ApiExecuteSQLError('Failed to insert submission feature artifact records', [
        'SubmissionFeatureArtifactRepository->insertSubmissionFeatureArtifacts',
        `rowCount was ${response.rowCount}, expected ${submissionFeatureArtifacts.length}`
      ]);
    }
  }

  /**
   * Soft-delete submission_feature_artifact links for active features in the given submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactRepository
   */
  async softDeleteBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature_artifact sfa
      SET record_end_date = NOW()
      FROM submission_feature sf
      WHERE sfa.submission_feature_id = sf.submission_feature_id
        AND sf.submission_upload_id = ${submissionUploadId}
        AND sf.record_end_date IS NULL
        AND sfa.record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }
}

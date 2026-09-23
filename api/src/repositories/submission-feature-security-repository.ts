import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { SubmissionFeatureSecurityRecord } from '../models/submission-feature-security';
import { BaseRepository } from './base-repository';

export class SubmissionFeatureSecurityRepository extends BaseRepository {
  /**
   * Copy current rules from each reconciliation baseline to its successor occurrence.
   *
   * Assignment provenance and expiry are preserved. Existing successor assignments and all
   * predecessor assignments are left unchanged, making this operation retry-safe.
   *
   * @param {string} submissionUploadId Pending successor upload identifier.
   * @param {string | null} predecessorSubmissionUploadId Preferred pending predecessor upload identifier.
   * @returns {Promise<void>} Resolves after copying assignments.
   * @memberof SubmissionFeatureSecurityRepository
   */
  async copySubmissionFeatureSecurityToSuccessors(
    submissionUploadId: string,
    predecessorSubmissionUploadId: string | null
  ): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO submission_feature_security
        (submission_feature_id, security_rule_id, submission_upload_review_id, submission_upload_security_id, record_effective_date, record_end_date)
      SELECT
        incoming.submission_feature_id,
        predecessor_security.security_rule_id,
        predecessor_security.submission_upload_review_id,
        predecessor_security.submission_upload_security_id,
        now(),
        predecessor_security.record_end_date
      FROM submission_feature incoming
      JOIN LATERAL (
        SELECT candidate.submission_feature_id
        FROM submission_feature candidate
        WHERE candidate.submission_id = incoming.submission_id
          AND candidate.source_id = incoming.source_id
          AND (
            candidate.submission_upload_id = ${predecessorSubmissionUploadId}::uuid
            OR (
              candidate.record_effective_date <= now()
              AND (candidate.record_end_date IS NULL OR now() < candidate.record_end_date)
              AND candidate.successor_submission_feature_id IS NULL
            )
          )
        ORDER BY
          (candidate.submission_upload_id = ${predecessorSubmissionUploadId}::uuid) DESC,
          candidate.submission_feature_id DESC
        LIMIT 1
      ) predecessor ON true
      JOIN submission_feature_security predecessor_security
        ON predecessor_security.submission_feature_id = predecessor.submission_feature_id
      WHERE incoming.submission_upload_id = ${submissionUploadId}::uuid
        AND incoming.reconciliation IS NOT NULL
        AND incoming.record_effective_date IS NULL
        AND incoming.record_end_date IS NULL
        AND predecessor_security.record_effective_date <= now()
        AND (predecessor_security.record_end_date IS NULL OR now() < predecessor_security.record_end_date)
      ON CONFLICT (submission_feature_id, security_rule_id) DO NOTHING;
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Gets Submission Feature Security Records for a given set of submission features
   *
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<SubmissionFeatureSecurityRecord[]>}
   * @memberof SubmissionFeatureSecurityRepository
   */
  async getSubmissionFeatureSecurities(submissionFeatureIds: number[]): Promise<SubmissionFeatureSecurityRecord[]> {
    const knex = getKnex();
    const queryBuilder = knex
      .queryBuilder()
      .select('*')
      .from('submission_feature_security')
      .whereIn('submission_feature_id', submissionFeatureIds)
      .where('record_effective_date', '<=', knex.fn.now())
      .where((lifecycle) => lifecycle.whereNull('record_end_date').orWhere('record_end_date', '>', knex.fn.now()));

    const response = await this.connection.knex(queryBuilder, SubmissionFeatureSecurityRecord);

    return response.rows;
  }
}

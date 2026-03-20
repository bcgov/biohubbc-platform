import { BaseRepository } from './base-repository';
import { SubmissionFeatureRecordWithTypeAndSecurity } from './submission-repository';

export class SubmissionFeaturePropertyIndexRepository extends BaseRepository {
  /**
   * Stream submission features for a specific upload attempt using a server-side cursor.
   *
   * Must be called within an open transaction (cursors require a transaction context).
   *
   * @param {string} submissionUploadId
   * @param {number} [batchSize=10000]
   * @yields {SubmissionFeatureRecordWithTypeAndSecurity[]}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async *streamSubmissionFeaturesBySubmissionUploadId(
    submissionUploadId: string,
    batchSize = 10000
  ): AsyncGenerator<SubmissionFeatureRecordWithTypeAndSecurity[]> {
    const safeBatchSize = Number.isInteger(batchSize) && batchSize > 0 ? batchSize : 10000;
    const cursorName = `submission_feature_upload_cursor_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    await this.connection.query(
      `DECLARE ${cursorName} CURSOR FOR
        SELECT
          submission_feature.*,
          feature_type.name as feature_type_name,
          feature_type.display_name as feature_type_display_name,
          array_remove(array_agg(submission_feature_security.submission_feature_security_id), NULL) AS submission_feature_security_ids
        FROM
          submission_feature
        INNER JOIN
          feature_type
        ON
          feature_type.feature_type_id = submission_feature.feature_type_id
        LEFT JOIN
          submission_feature_security
        ON
          submission_feature_security.submission_feature_id = submission_feature.submission_feature_id
        WHERE
          submission_feature.submission_upload_id = $1
          AND submission_feature.record_end_date IS NULL
        GROUP BY
          submission_feature.submission_feature_id,
          feature_type.name,
          feature_type.display_name,
          feature_type.sort
        ORDER BY
          submission_feature.submission_feature_id ASC`,
      [submissionUploadId]
    );

    try {
      while (true) {
        const response = await this.connection.query<SubmissionFeatureRecordWithTypeAndSecurity>(
          `FETCH ${safeBatchSize} FROM ${cursorName}`
        );

        if (!response.rows.length) {
          break;
        }

        yield response.rows;
      }
    } finally {
      await this.connection.query(`CLOSE ${cursorName}`);
    }
  }
}

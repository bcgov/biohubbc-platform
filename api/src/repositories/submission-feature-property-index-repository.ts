import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../errors/api-error';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { BaseRepository } from './base-repository';
import { SubmissionFeatureRecordWithTypeAndSecurity } from './submission-repository';

const FeatureTypePropertyMetadata = z.object({
  metadata: FeatureTypeProperty
});

export class SubmissionFeaturePropertyIndexRepository extends BaseRepository {
  private static cursorSequence = 0;

  private static nextCursorName(): string {
    SubmissionFeaturePropertyIndexRepository.cursorSequence += 1;
    return `submission_feature_upload_cursor_${Date.now()}_${process.pid}_${
      SubmissionFeaturePropertyIndexRepository.cursorSequence
    }`;
  }

  /**
   * Resolve canonical feature type property classification metadata in one query for all feature types in a batch.
   *
   * @param {number[]} featureTypeIds
   * @return {Promise<FeatureTypeProperty[]>}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async getFeatureTypePropertyClassificationsByFeatureTypeIds(
    featureTypeIds: number[]
  ): Promise<FeatureTypeProperty[]> {
    if (!featureTypeIds.length) {
      return [];
    }

    const sql = SQL`
      SELECT
        jsonb_build_object(
          'feature_type_id', ftp.feature_type_id,
          'feature_type_property_id', ftp.feature_type_property_id,
          'name', fp.name,
          'display_name', fp.display_name,
          'description', fp.description,
          'type_name', fpt.name,
          'required_value', COALESCE(ftp.required_value, false),
          'calculated_value', COALESCE(fp.calculated_value, false),
          'allow_multiple', COALESCE(ftp.allow_multiple, false)
        ) AS metadata
      FROM
        feature_type_property ftp
      INNER JOIN
        feature_property fp
      ON
        fp.feature_property_id = ftp.feature_property_id
      INNER JOIN
        feature_property_type fpt
      ON
        fpt.feature_property_type_id = fp.feature_property_type_id
      WHERE
        ftp.feature_type_id = ANY(${featureTypeIds}::integer[])
        AND ftp.record_end_date IS NULL
        AND fp.record_end_date IS NULL
        AND fpt.record_end_date IS NULL;
    `;

    const response = await this.connection.sql(sql, FeatureTypePropertyMetadata);

    return response.rows.map((row) => row.metadata);
  }

  /**
   * Stream submission features for a specific upload attempt using a server-side cursor.
   *
   * Must be called within an open transaction (cursors require a transaction context).
   *
   * @param {string} submissionUploadId
   * @param {number} batchSize
   * @yields {SubmissionFeatureRecordWithTypeAndSecurity[]}
   * @memberof SubmissionFeaturePropertyIndexRepository
   */
  async *streamSubmissionFeaturesBySubmissionUploadId(
    submissionUploadId: string,
    batchSize: number
  ): AsyncGenerator<SubmissionFeatureRecordWithTypeAndSecurity[]> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new ApiExecuteSQLError('Invalid batch size for submission feature streaming', [
        'SubmissionFeaturePropertyIndexRepository->streamSubmissionFeaturesBySubmissionUploadId',
        {
          submissionUploadId,
          batchSize
        }
      ]);
    }

    const cursorName = SubmissionFeaturePropertyIndexRepository.nextCursorName();

    const declareCursorSql = SQL`DECLARE `;
    declareCursorSql.append(cursorName);
    declareCursorSql.append(SQL` CURSOR FOR
        SELECT
          submission_feature.*,
          feature_type.name AS feature_type_name,
          feature_type.display_name AS feature_type_display_name,
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
          submission_feature.submission_upload_id = ${submissionUploadId}
          AND submission_feature.record_end_date IS NULL
        GROUP BY
          submission_feature.submission_feature_id,
          feature_type.name,
          feature_type.display_name,
          feature_type.sort
        ORDER BY
          submission_feature.submission_feature_id ASC`);
    await this.connection.sql(declareCursorSql);

    let lastFetchedSubmissionFeatureId = 0;

    try {
      while (true) {
        const fetchCursorSql = SQL`FETCH `;
        fetchCursorSql.append(String(batchSize));
        fetchCursorSql.append(SQL` FROM `);
        fetchCursorSql.append(cursorName);

        const response = await this.connection.sql(fetchCursorSql, SubmissionFeatureRecordWithTypeAndSecurity);

        if (!response.rows.length) {
          break;
        }

        const firstSubmissionFeatureId = response.rows[0].submission_feature_id;
        const lastSubmissionFeatureId = response.rows[response.rows.length - 1].submission_feature_id;

        if (
          firstSubmissionFeatureId <= lastFetchedSubmissionFeatureId ||
          lastSubmissionFeatureId < firstSubmissionFeatureId
        ) {
          throw new ApiExecuteSQLError('Submission feature cursor did not advance', [
            'SubmissionFeaturePropertyIndexRepository->streamSubmissionFeaturesBySubmissionUploadId',
            {
              submissionUploadId,
              batchSize,
              firstSubmissionFeatureId,
              lastSubmissionFeatureId,
              lastFetchedSubmissionFeatureId
            }
          ]);
        }

        lastFetchedSubmissionFeatureId = lastSubmissionFeatureId;

        yield response.rows;
      }
    } finally {
      const closeCursorSql = SQL`CLOSE `;
      closeCursorSql.append(cursorName);
      await this.connection.sql(closeCursorSql);
    }
  }
}

import SQL from 'sql-template-strings';
import { z } from 'zod';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { IngestionValidationError } from '../../errors/submission-errors';
import { CreateSubmissionFeatureIngestionRecord, InsertSubmissionFeatureRecord } from '../../models/submission-feature';
import { BaseRepository } from '../base-repository';

/**
 * A repository class for ingestion-related data access.
 *
 * @export
 * @class FeatureIngestionRepository
 * @extends {BaseRepository}
 */
export class FeatureIngestionRepository extends BaseRepository {
  /**
   * Bulk insert submission feature rows (raw payload persisted in `data`).
   *
   * @param {CreateSubmissionFeatureIngestionRecord[]} records
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatureRecords(records: CreateSubmissionFeatureIngestionRecord[]): Promise<void> {
    if (!records.length) {
      return;
    }

    const submissionIds = records.map((record) => record.submissionId);
    const submissionUploadIds = records.map((record) => record.submissionUploadId);
    const sourceIds = records.map((record) => record.sourceId);
    const featureTypeNames = records.map((record) => record.featureTypeName);
    const dataValues = records.map((record) => JSON.stringify(record.data));
    const dataByteSizes = records.map((record) => record.dataByteSize);

    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size
      )
      SELECT
        staged.submission_id,
        staged.submission_upload_id,
        NULL,
        staged.source_id,
        ft.feature_type_id,
        parsed.data,
        staged.data_byte_size
      FROM unnest(
        ${submissionIds}::integer[],
        ${submissionUploadIds}::uuid[],
        ${sourceIds}::text[],
        ${featureTypeNames}::text[],
        ${dataValues}::text[],
        ${dataByteSizes}::bigint[]
      ) AS staged(
        submission_id,
        submission_upload_id,
        source_id,
        feature_type_name,
        data_text,
        data_byte_size
      )
      INNER JOIN feature_type ft ON ft.name = staged.feature_type_name AND ft.record_end_date IS NULL
      CROSS JOIN LATERAL (SELECT staged.data_text::jsonb AS data) parsed;
    `;

    const response = await this.connection.sql(sqlStatement);
    const insertedCount = response.rowCount ?? 0;
    const expectedCount = records.length;

    if (insertedCount !== expectedCount) {
      throw new IngestionValidationError(
        `Failed to insert all submission feature records: inserted ${insertedCount} of ${expectedCount}`
      );
    }
  }

  /**
   * Insert a new submission feature record.
   * Features belong to a submission (submission_id) but are produced by a specific
   * upload event (submission_upload_id). This distinction enables multi-upload-per-submission
   * (append, replace).
   *
   * @param {InsertSubmissionFeatureRecord} record The submission feature insert payload.
   * @return {*}  {Promise<{ submission_feature_id: number }>}
   * @memberof FeatureIngestionRepository
   */
  async insertSubmissionFeatureRecord(
    record: InsertSubmissionFeatureRecord
  ): Promise<{ submission_feature_id: number }> {
    const {
      submissionId,
      submissionUploadId,
      parentSubmissionFeatureId,
      featureSourceId,
      featureTypeName,
      featureProperties,
      dataByteSizeBytes
    } = record;

    const sqlStatement = SQL`
      INSERT INTO submission_feature (
        submission_id,
        submission_upload_id,
        parent_submission_feature_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        record_effective_date
      ) VALUES (
        ${submissionId},
        ${submissionUploadId},
        ${parentSubmissionFeatureId},
        ${featureSourceId},
        (SELECT feature_type_id FROM feature_type WHERE name = ${featureTypeName}),
        ${featureProperties},
        ${dataByteSizeBytes},
        now()
      )
      RETURNING
        submission_feature_id;
    `;

    const response = await this.connection.sql(sqlStatement, z.object({ submission_feature_id: z.number() }));

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission feature record', [
        'FeatureIngestionRepository->insertSubmissionFeatureRecord',
        'rowCount was null or undefined, expected rowCount = 1'
      ]);
    }

    return response.rows[0];
  }

  /**
   * Set parent references from `submission_feature.data.parent` within the same upload scope.
   *
   * @param {string} submissionUploadId The submission_upload_id scope.
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async updateSubmissionFeatureParentsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature AS child
      SET parent_submission_feature_id = parent.submission_feature_id
      FROM submission_feature AS parent
      WHERE child.submission_upload_id = ${submissionUploadId}::uuid
        AND parent.submission_upload_id = ${submissionUploadId}::uuid
        AND child.record_end_date IS NULL
        AND parent.record_end_date IS NULL
        AND parent.source_id IS NOT NULL
        AND jsonb_typeof(child.data -> 'parent') = 'string'
        AND btrim(child.data ->> 'parent') <> ''
        AND parent.source_id = btrim(child.data ->> 'parent');
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Soft-delete features scoped to a specific upload event.
   * Multiple uploads produce features under the same submission_id;
   * re-ingesting one upload must not affect features from other uploads.
   *
   * @param {string} submissionUploadId The submission_upload_id (UUID).
   * @return {Promise<void>}
   * @memberof FeatureIngestionRepository
   */
  async deleteSubmissionFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const sqlStatement = SQL`
      UPDATE submission_feature
      SET record_end_date = NOW()
      WHERE submission_upload_id = ${submissionUploadId}
        AND record_end_date IS NULL;
    `;

    await this.connection.sql(sqlStatement);
  }
}

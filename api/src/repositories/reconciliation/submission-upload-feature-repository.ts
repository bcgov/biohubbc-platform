import { SQL } from 'sql-template-strings';
import { getKnex } from '../../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import {
  CreateSubmissionUploadFeature,
  SubmissionUploadFeature,
  UpdateSubmissionUploadFeature
} from '../../models/submission-upload-feature';
import { BaseRepository } from '../base-repository';

/**
 * Repository for retained parsed submission upload feature records.
 *
 * @export
 * @class SubmissionUploadFeatureRepository
 * @extends {BaseRepository}
 */
export class SubmissionUploadFeatureRepository extends BaseRepository {
  /**
   * Insert an immutable parsed submission upload feature.
   *
   * @param {CreateSubmissionUploadFeature} data Submitted feature fields.
   * @returns {Promise<SubmissionUploadFeature>} The inserted submission upload feature.
   * @memberof SubmissionUploadFeatureRepository
   */
  async insertSubmissionUploadFeature(data: CreateSubmissionUploadFeature): Promise<SubmissionUploadFeature> {
    const sql = SQL`
      INSERT INTO submission_upload_feature (
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id
      ) VALUES (
        ${data.submission_upload_id}::uuid,
        ${data.source_id},
        ${data.feature_type_id},
        ${JSON.stringify(data.data)}::jsonb,
        ${data.data_byte_size},
        ${data.content_hash},
        ${data.universal_id}
      )
      RETURNING
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        reconciliation,
        metadata;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadFeature);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission upload feature', [
        'SubmissionUploadFeatureRepository->insertSubmissionUploadFeature',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission upload feature by its primary key.
   *
   * @param {string} submissionUploadFeatureId Submission upload feature identifier.
   * @returns {Promise<SubmissionUploadFeature>} The matching upload feature.
   * @memberof SubmissionUploadFeatureRepository
   */
  async getSubmissionUploadFeature(submissionUploadFeatureId: string): Promise<SubmissionUploadFeature> {
    const sql = SQL`
      SELECT
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        reconciliation,
        metadata
      FROM submission_upload_feature
      WHERE submission_upload_feature_id = ${submissionUploadFeatureId}::uuid;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadFeature);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload feature not found', [
        'SubmissionUploadFeatureRepository->getSubmissionUploadFeature',
        { submissionUploadFeatureId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadFeatureRepository->getSubmissionUploadFeature',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get all retained features belonging to a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadFeature[]>} Upload features in stable identifier order.
   * @memberof SubmissionUploadFeatureRepository
   */
  async getSubmissionUploadFeaturesForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionUploadFeature[]> {
    const sql = SQL`
      SELECT
        submission_upload_feature_id,
        submission_upload_id,
        source_id,
        feature_type_id,
        data,
        data_byte_size,
        content_hash,
        universal_id,
        reconciliation,
        metadata
      FROM submission_upload_feature
      WHERE submission_upload_id = ${submissionUploadId}::uuid
      ORDER BY submission_upload_feature_id;
    `;

    const response = await this.connection.sql(sql, SubmissionUploadFeature);

    return response.rows;
  }

  /**
   * Update only the derived reconciliation fields for an upload feature.
   *
   * The immutable submitted content is intentionally excluded from this operation.
   *
   * @param {string} submissionUploadFeatureId Submission upload feature identifier.
   * @param {UpdateSubmissionUploadFeature} data Derived reconciliation fields to update.
   * @returns {Promise<SubmissionUploadFeature>} The updated upload feature.
   * @memberof SubmissionUploadFeatureRepository
   */
  async updateSubmissionUploadFeature(
    submissionUploadFeatureId: string,
    data: UpdateSubmissionUploadFeature
  ): Promise<SubmissionUploadFeature> {
    const updateData: UpdateSubmissionUploadFeature = {};

    if (data.reconciliation !== undefined) {
      updateData.reconciliation = data.reconciliation;
    }

    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    if (Object.keys(updateData).length === 0) {
      throw new ApiExecuteSQLError('No submission upload feature fields to update', [
        'SubmissionUploadFeatureRepository->updateSubmissionUploadFeature'
      ]);
    }

    const knex = getKnex();
    const query = knex('submission_upload_feature')
      .where('submission_upload_feature_id', submissionUploadFeatureId)
      .update(updateData)
      .returning([
        'submission_upload_feature_id',
        'submission_upload_id',
        'source_id',
        'feature_type_id',
        'data',
        'data_byte_size',
        'content_hash',
        'universal_id',
        'reconciliation',
        'metadata'
      ]);

    const response = await this.connection.knex(query, SubmissionUploadFeature);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('Submission upload feature not found', [
        'SubmissionUploadFeatureRepository->updateSubmissionUploadFeature',
        { submissionUploadFeatureId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionUploadFeatureRepository->updateSubmissionUploadFeature',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }
}

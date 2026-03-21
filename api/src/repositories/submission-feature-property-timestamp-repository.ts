import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyTimestamp,
  SubmissionFeaturePropertyTimestamp,
  SubmissionFeaturePropertyTimestampSchema
} from '../models/submission-feature-property-timestamp';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyTimestampRepository extends BaseRepository {
  /**
   * Insert multiple submission_feature_property_timestamp rows.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp[]} payloads
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async insertSubmissionFeaturePropertyTimestamps(
    payloads: CreateSubmissionFeaturePropertyTimestamp[]
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    if (!payloads.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp').insert(payloads).returning([
      'submission_feature_property_timestamp_id',
      'submission_feature_id',
      'feature_type_property_id',
      'value'
    ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestampSchema);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_timestamp rows', [
        'SubmissionFeaturePropertyTimestampRepository->insertSubmissionFeaturePropertyTimestamps',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Insert a submission_feature_property_timestamp row.
   *
   * @param {CreateSubmissionFeaturePropertyTimestamp} payload
   * @return {Promise<SubmissionFeaturePropertyTimestamp>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async insertSubmissionFeaturePropertyTimestamp(
    payload: CreateSubmissionFeaturePropertyTimestamp
  ): Promise<SubmissionFeaturePropertyTimestamp> {
    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .insert(payload)
      .returning([
        'submission_feature_property_timestamp_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestampSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_timestamp', [
        'SubmissionFeaturePropertyTimestampRepository->insertSubmissionFeaturePropertyTimestamp',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_timestamp row by id.
   *
   * @param {number} submissionFeaturePropertyTimestampId
   * @return {Promise<SubmissionFeaturePropertyTimestamp>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async getSubmissionFeaturePropertyTimestampById(
    submissionFeaturePropertyTimestampId: number
  ): Promise<SubmissionFeaturePropertyTimestamp> {
    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .select([
        'submission_feature_property_timestamp_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ])
      .where('submission_feature_property_timestamp_id', submissionFeaturePropertyTimestampId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestampSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_timestamp not found', [
        'SubmissionFeaturePropertyTimestampRepository->getSubmissionFeaturePropertyTimestampById',
        { submissionFeaturePropertyTimestampId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyTimestampRepository->getSubmissionFeaturePropertyTimestampById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_timestamp rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async getSubmissionFeaturePropertyTimestampBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .select([
        'submission_feature_property_timestamp_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestampSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_timestamp rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyTimestamp[]>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async getSubmissionFeaturePropertyTimestampByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTimestamp[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .select([
        'submission_feature_property_timestamp_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestampSchema);

    return response.rows;
  }

  /**
   * Delete submission_feature_property_timestamp rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async deleteSubmissionFeaturePropertyTimestampsBySubmissionId(submissionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .whereIn(
        'submission_feature_id',
        knex('submission_feature').select('submission_feature_id').where('submission_id', submissionId)
      )
      .delete();

    await this.connection.knex(query);
  }

  /**
   * Delete submission_feature_property_timestamp rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTimestampRepository
   */
  async deleteSubmissionFeaturePropertyTimestampsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('submission_feature_property_timestamp')
      .whereIn(
        'submission_feature_id',
        knex('submission_feature').select('submission_feature_id').where('submission_upload_id', submissionUploadId)
      )
      .delete();

    await this.connection.knex(query);
  }
}

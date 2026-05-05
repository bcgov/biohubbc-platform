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
   * Insert a submission_feature_property_timestamp row.
   *
   * Caller is responsible for splitting any JS `Date` / `dayjs` value into the two component
   * fields before calling. The DB CHECK constraint enforces "at least one component non-null" —
   * if both are null the SQL surfaces the error; the repository does not pre-check.
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
        'date_value',
        'time_value'
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
        'date_value',
        'time_value'
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
        'date_value',
        'time_value'
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
        'date_value',
        'time_value'
      ])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTimestampSchema);

    return response.rows;
  }
}

import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBoolean,
  SubmissionFeaturePropertyBooleanSchema
} from '../models/submission-feature-property-boolean';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyBooleanRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_boolean row.
   *
   * @param {CreateSubmissionFeaturePropertyBoolean} payload
   * @return {Promise<SubmissionFeaturePropertyBoolean>}
   * @memberof SubmissionFeaturePropertyBooleanRepository
   */
  async insertSubmissionFeaturePropertyBoolean(
    payload: CreateSubmissionFeaturePropertyBoolean
  ): Promise<SubmissionFeaturePropertyBoolean> {
    const knex = getKnex();
    const query = knex('submission_feature_property_boolean')
      .insert(payload)
      .returning([
        'submission_feature_property_boolean_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyBooleanSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_boolean', [
        'SubmissionFeaturePropertyBooleanRepository->insertSubmissionFeaturePropertyBoolean',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_boolean row by id.
   *
   * @param {number} submissionFeaturePropertyBooleanId
   * @return {Promise<SubmissionFeaturePropertyBoolean>}
   * @memberof SubmissionFeaturePropertyBooleanRepository
   */
  async getSubmissionFeaturePropertyBooleanById(
    submissionFeaturePropertyBooleanId: number
  ): Promise<SubmissionFeaturePropertyBoolean> {
    const knex = getKnex();
    const query = knex('submission_feature_property_boolean')
      .select(['submission_feature_property_boolean_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('submission_feature_property_boolean_id', submissionFeaturePropertyBooleanId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyBooleanSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_boolean not found', [
        'SubmissionFeaturePropertyBooleanRepository->getSubmissionFeaturePropertyBooleanById',
        { submissionFeaturePropertyBooleanId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyBooleanRepository->getSubmissionFeaturePropertyBooleanById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_boolean rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyBoolean[]>}
   * @memberof SubmissionFeaturePropertyBooleanRepository
   */
  async getSubmissionFeaturePropertyBooleanBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_boolean')
      .select(['submission_feature_property_boolean_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyBooleanSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_boolean rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyBoolean[]>}
   * @memberof SubmissionFeaturePropertyBooleanRepository
   */
  async getSubmissionFeaturePropertyBooleanByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyBoolean[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_boolean')
      .select(['submission_feature_property_boolean_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyBooleanSchema);

    return response.rows;
  }
}

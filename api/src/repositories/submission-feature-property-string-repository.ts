import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyString,
  SubmissionFeaturePropertyString,
  SubmissionFeaturePropertyStringSchema
} from '../models/submission-feature-property-string';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyStringRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_string row.
   *
   * @param {CreateSubmissionFeaturePropertyString} payload
   * @return {Promise<SubmissionFeaturePropertyString>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async insertSubmissionFeaturePropertyString(
    payload: CreateSubmissionFeaturePropertyString
  ): Promise<SubmissionFeaturePropertyString> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .insert(payload)
      .returning([
        'submission_feature_property_string_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_string', [
        'SubmissionFeaturePropertyStringRepository->insertSubmissionFeaturePropertyString',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_string row by id.
   *
   * @param {number} submissionFeaturePropertyStringId
   * @return {Promise<SubmissionFeaturePropertyString>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async getSubmissionFeaturePropertyStringById(
    submissionFeaturePropertyStringId: number
  ): Promise<SubmissionFeaturePropertyString> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .select([
        'submission_feature_property_string_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ])
      .where('submission_feature_property_string_id', submissionFeaturePropertyStringId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_string not found', [
        'SubmissionFeaturePropertyStringRepository->getSubmissionFeaturePropertyStringById',
        { submissionFeaturePropertyStringId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyStringRepository->getSubmissionFeaturePropertyStringById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_string rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async getSubmissionFeaturePropertyStringBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .select([
        'submission_feature_property_string_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_string rows by blueprint feature type property id.
   *
   * @param {number} blueprintFeatureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async getSubmissionFeaturePropertyStringByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .select([
        'submission_feature_property_string_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ])
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    return response.rows;
  }
}

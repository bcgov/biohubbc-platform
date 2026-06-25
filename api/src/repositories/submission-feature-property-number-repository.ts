import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumber,
  SubmissionFeaturePropertyNumberSchema
} from '../models/submission-feature-property-number';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyNumberRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_number row.
   *
   * @param {CreateSubmissionFeaturePropertyNumber} payload
   * @return {Promise<SubmissionFeaturePropertyNumber>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async insertSubmissionFeaturePropertyNumber(
    payload: CreateSubmissionFeaturePropertyNumber
  ): Promise<SubmissionFeaturePropertyNumber> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .insert(payload)
      .returning([
        'submission_feature_property_number_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_number', [
        'SubmissionFeaturePropertyNumberRepository->insertSubmissionFeaturePropertyNumber',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_number row by id.
   *
   * @param {number} submissionFeaturePropertyNumberId
   * @return {Promise<SubmissionFeaturePropertyNumber>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async getSubmissionFeaturePropertyNumberById(
    submissionFeaturePropertyNumberId: number
  ): Promise<SubmissionFeaturePropertyNumber> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .select([
        'submission_feature_property_number_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ])
      .where('submission_feature_property_number_id', submissionFeaturePropertyNumberId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_number not found', [
        'SubmissionFeaturePropertyNumberRepository->getSubmissionFeaturePropertyNumberById',
        { submissionFeaturePropertyNumberId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyNumberRepository->getSubmissionFeaturePropertyNumberById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_number rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async getSubmissionFeaturePropertyNumberBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .select([
        'submission_feature_property_number_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_number rows by blueprint feature type property id.
   *
   * @param {number} blueprintFeatureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async getSubmissionFeaturePropertyNumberByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .select([
        'submission_feature_property_number_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'value'
      ])
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    return response.rows;
  }
}

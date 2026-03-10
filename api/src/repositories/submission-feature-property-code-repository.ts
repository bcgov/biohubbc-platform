import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCode,
  SubmissionFeaturePropertyCodeSchema
} from '../models/submission-feature-property-code';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyCodeRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_code row.
   *
   * @param {CreateSubmissionFeaturePropertyCode} payload
   * @return {Promise<SubmissionFeaturePropertyCode>}
   * @memberof SubmissionFeaturePropertyCodeRepository
   */
  async insertSubmissionFeaturePropertyCode(
    payload: CreateSubmissionFeaturePropertyCode
  ): Promise<SubmissionFeaturePropertyCode> {
    const knex = getKnex();
    const query = knex('submission_feature_property_code')
      .insert(payload)
      .returning([
        'submission_feature_property_code_id',
        'submission_feature_id',
        'feature_type_property_id',
        'code_id'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyCodeSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_code', [
        'SubmissionFeaturePropertyCodeRepository->insertSubmissionFeaturePropertyCode',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_code row by id.
   *
   * @param {number} submissionFeaturePropertyCodeId
   * @return {Promise<SubmissionFeaturePropertyCode>}
   * @memberof SubmissionFeaturePropertyCodeRepository
   */
  async getSubmissionFeaturePropertyCodeById(
    submissionFeaturePropertyCodeId: number
  ): Promise<SubmissionFeaturePropertyCode> {
    const knex = getKnex();
    const query = knex('submission_feature_property_code')
      .select(['submission_feature_property_code_id', 'submission_feature_id', 'feature_type_property_id', 'code_id'])
      .where('submission_feature_property_code_id', submissionFeaturePropertyCodeId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyCodeSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_code not found', [
        'SubmissionFeaturePropertyCodeRepository->getSubmissionFeaturePropertyCodeById',
        { submissionFeaturePropertyCodeId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyCodeRepository->getSubmissionFeaturePropertyCodeById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_code rows by submission_feature_id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeRepository
   */
  async getSubmissionFeaturePropertyCodesBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_code')
      .select(['submission_feature_property_code_id', 'submission_feature_id', 'feature_type_property_id', 'code_id'])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyCodeSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_code rows by feature_type_property_id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeRepository
   */
  async getSubmissionFeaturePropertyCodesByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyCode[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_code')
      .select(['submission_feature_property_code_id', 'submission_feature_id', 'feature_type_property_id', 'code_id'])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyCodeSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_code rows by code_id.
   *
   * @param {number} codeId
   * @return {Promise<SubmissionFeaturePropertyCode[]>}
   * @memberof SubmissionFeaturePropertyCodeRepository
   */
  async getSubmissionFeaturePropertyCodesByCodeId(codeId: number): Promise<SubmissionFeaturePropertyCode[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_code')
      .select(['submission_feature_property_code_id', 'submission_feature_id', 'feature_type_property_id', 'code_id'])
      .where('code_id', codeId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyCodeSchema);

    return response.rows;
  }
}

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
   * Insert multiple submission_feature_property_number rows.
   *
   * @param {CreateSubmissionFeaturePropertyNumber[]} payloads
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async insertSubmissionFeaturePropertyNumbers(
    payloads: CreateSubmissionFeaturePropertyNumber[]
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    if (!payloads.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .insert(payloads)
      .returning([
        'submission_feature_property_number_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_number rows', [
        'SubmissionFeaturePropertyNumberRepository->insertSubmissionFeaturePropertyNumbers',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

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
        'feature_type_property_id',
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
      .select(['submission_feature_property_number_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
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
      .select(['submission_feature_property_number_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_number rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyNumber[]>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async getSubmissionFeaturePropertyNumberByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyNumber[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .select(['submission_feature_property_number_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyNumberSchema);

    return response.rows;
  }

  /**
   * Delete submission_feature_property_number rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async deleteSubmissionFeaturePropertyNumbersBySubmissionId(submissionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .whereIn(
        'submission_feature_id',
        knex('submission_feature').select('submission_feature_id').where('submission_id', submissionId)
      )
      .delete();

    await this.connection.knex(query);
  }

  /**
   * Delete submission_feature_property_number rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyNumberRepository
   */
  async deleteSubmissionFeaturePropertyNumbersBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('submission_feature_property_number')
      .whereIn(
        'submission_feature_id',
        knex('submission_feature').select('submission_feature_id').where('submission_upload_id', submissionUploadId)
      )
      .delete();

    await this.connection.knex(query);
  }
}

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
   * Insert multiple submission_feature_property_string rows.
   *
   * @param {CreateSubmissionFeaturePropertyString[]} payloads
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async insertSubmissionFeaturePropertyStrings(
    payloads: CreateSubmissionFeaturePropertyString[]
  ): Promise<SubmissionFeaturePropertyString[]> {
    if (!payloads.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .insert(payloads)
      .returning([
        'submission_feature_property_string_id',
        'submission_feature_id',
        'feature_type_property_id',
        'value'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    if (response.rowCount !== payloads.length) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_string rows', [
        'SubmissionFeaturePropertyStringRepository->insertSubmissionFeaturePropertyStrings',
        `rowCount was ${response.rowCount}, expected ${payloads.length}`
      ]);
    }

    return response.rows;
  }

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
        'feature_type_property_id',
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
      .select(['submission_feature_property_string_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
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
      .select(['submission_feature_property_string_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_string rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyString[]>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async getSubmissionFeaturePropertyStringByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyString[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .select(['submission_feature_property_string_id', 'submission_feature_id', 'feature_type_property_id', 'value'])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyStringSchema);

    return response.rows;
  }

  /**
   * Delete submission_feature_property_string rows for a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async deleteSubmissionFeaturePropertyStringsBySubmissionId(submissionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .whereIn(
        'submission_feature_id',
        knex('submission_feature').select('submission_feature_id').where('submission_id', submissionId)
      )
      .delete();

    await this.connection.knex(query);
  }

  /**
   * Delete submission_feature_property_string rows for a submission upload.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyStringRepository
   */
  async deleteSubmissionFeaturePropertyStringsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    const knex = getKnex();
    const query = knex('submission_feature_property_string')
      .whereIn(
        'submission_feature_id',
        knex('submission_feature').select('submission_feature_id').where('submission_upload_id', submissionUploadId)
      )
      .delete();

    await this.connection.knex(query);
  }
}

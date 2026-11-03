import { getKnex } from '../database/db';
import { CountResult } from '../models/count';
import { SubmissionFeatureError } from '../models/submission-feature-error';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

export class SubmissionFeatureErrorRepository extends BaseRepository {
  /**
   * List one page of the aggregated ingestion errors recorded for a submission upload.
   *
   * The feature type is that of the Blueprint assignment the error refers to, so it is null for an error that is not
   * about a property, which is counted across the feature types of the upload.
   *
   * @param {string} submissionUploadId Upload whose errors are listed.
   * @param {ApiPaginationOptions} pagination Page size, offset and validated sort.
   * @returns {Promise<SubmissionFeatureError[]>} One page of error records, with stable ordering.
   */
  async listSubmissionFeatureErrors(
    submissionUploadId: string,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureError[]> {
    const knex = getKnex();
    const query = knex('submission_feature_error as sfe')
      .select(
        'sfe.submission_feature_error_id',
        'sfe.error_code',
        'sfe.error_message',
        'ft.name as feature_type_name',
        'sfe.property_name',
        'sfe.count'
      )
      .leftJoin(
        'blueprint_feature_type_property as bftp',
        'bftp.blueprint_feature_type_property_id',
        'sfe.blueprint_feature_type_property_id'
      )
      .leftJoin('blueprint_feature_type as bft', 'bft.blueprint_feature_type_id', 'bftp.blueprint_feature_type_id')
      .leftJoin('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .where('sfe.submission_upload_id', submissionUploadId)
      .orderBy(pagination.sort ?? 'count', pagination.order ?? 'desc')
      .orderBy('sfe.submission_feature_error_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    const response = await this.connection.knex(query, SubmissionFeatureError);
    return response.rows;
  }

  /**
   * Count the aggregated ingestion errors recorded for a submission upload.
   *
   * @param {string} submissionUploadId Upload whose errors are counted.
   * @returns {Promise<number>} Number of error records.
   */
  async countSubmissionFeatureErrors(submissionUploadId: string): Promise<number> {
    const knex = getKnex();
    const query = knex('submission_feature_error')
      .select(knex.raw('count(*)::integer as count'))
      .where('submission_upload_id', submissionUploadId);

    const response = await this.connection.knex(query, CountResult);
    return response.rows[0].count;
  }
}

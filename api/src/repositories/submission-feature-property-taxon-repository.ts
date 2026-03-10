import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxon,
  SubmissionFeaturePropertyTaxonSchema
} from '../models/submission-feature-property-taxon';
import { BaseRepository } from './base-repository';

export class SubmissionFeaturePropertyTaxonRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_taxon row.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon} payload
   * @return {Promise<SubmissionFeaturePropertyTaxon>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async insertSubmissionFeaturePropertyTaxon(
    payload: CreateSubmissionFeaturePropertyTaxon
  ): Promise<SubmissionFeaturePropertyTaxon> {
    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .insert(payload)
      .returning([
        'submission_feature_property_taxon_id',
        'submission_feature_id',
        'feature_type_property_id',
        'taxon_id'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_taxon', [
        'SubmissionFeaturePropertyTaxonRepository->insertSubmissionFeaturePropertyTaxon',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Bulk insert submission_feature_property_taxon rows.
   *
   * @param {CreateSubmissionFeaturePropertyTaxon[]} payload
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async insertSubmissionFeaturePropertyTaxonMany(
    payload: CreateSubmissionFeaturePropertyTaxon[]
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    if (!payload.length) {
      return [];
    }

    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .insert(payload)
      .returning([
        'submission_feature_property_taxon_id',
        'submission_feature_id',
        'feature_type_property_id',
        'taxon_id'
      ]);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    if (response.rowCount !== payload.length) {
      throw new ApiExecuteSQLError('Failed to bulk insert submission_feature_property_taxon', [
        'SubmissionFeaturePropertyTaxonRepository->insertSubmissionFeaturePropertyTaxonMany',
        `rowCount was ${response.rowCount}, expected ${payload.length}`
      ]);
    }

    return response.rows;
  }

  /**
   * Delete submission_feature_property_taxon rows for all features under a submission.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async deleteSubmissionFeaturePropertyTaxonBySubmissionId(submissionId: number): Promise<void> {
    const knex = getKnex();
    const featureIdSubquery = knex
      .select('submission_feature_id')
      .from('submission_feature')
      .where('submission_id', submissionId);

    const query = knex('submission_feature_property_taxon')
      .whereIn('submission_feature_id', featureIdSubquery)
      .delete();

    await this.connection.knex(query);
  }

  /**
   * Get a submission_feature_property_taxon row by id.
   *
   * @param {number} submissionFeaturePropertyTaxonId
   * @return {Promise<SubmissionFeaturePropertyTaxon>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async getSubmissionFeaturePropertyTaxonById(
    submissionFeaturePropertyTaxonId: number
  ): Promise<SubmissionFeaturePropertyTaxon> {
    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .select(['submission_feature_property_taxon_id', 'submission_feature_id', 'feature_type_property_id', 'taxon_id'])
      .where('submission_feature_property_taxon_id', submissionFeaturePropertyTaxonId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_taxon not found', [
        'SubmissionFeaturePropertyTaxonRepository->getSubmissionFeaturePropertyTaxonById',
        { submissionFeaturePropertyTaxonId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyTaxonRepository->getSubmissionFeaturePropertyTaxonById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_taxon rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async getSubmissionFeaturePropertyTaxonBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .select(['submission_feature_property_taxon_id', 'submission_feature_id', 'feature_type_property_id', 'taxon_id'])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_taxon rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async getSubmissionFeaturePropertyTaxonByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .select(['submission_feature_property_taxon_id', 'submission_feature_id', 'feature_type_property_id', 'taxon_id'])
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    return response.rows;
  }
}

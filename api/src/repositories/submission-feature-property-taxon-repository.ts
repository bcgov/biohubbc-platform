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
        'blueprint_feature_type_property_id',
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
      .select([
        'submission_feature_property_taxon_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'taxon_id'
      ])
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
      .select([
        'submission_feature_property_taxon_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'taxon_id'
      ])
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_taxon rows by blueprint feature type property id.
   *
   * @param {number} blueprintFeatureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyTaxon[]>}
   * @memberof SubmissionFeaturePropertyTaxonRepository
   */
  async getSubmissionFeaturePropertyTaxonByBlueprintFeatureTypePropertyId(
    blueprintFeatureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyTaxon[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_taxon')
      .select([
        'submission_feature_property_taxon_id',
        'submission_feature_id',
        'blueprint_feature_type_property_id',
        'taxon_id'
      ])
      .where('blueprint_feature_type_property_id', blueprintFeatureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyTaxonSchema);

    return response.rows;
  }
}

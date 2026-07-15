import { getKnex } from '../database/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import {
  CreateSubmissionFeaturePropertyArtifact,
  SubmissionFeaturePropertyArtifact,
  SubmissionFeaturePropertyArtifactSchema
} from '../models/submission-feature-property-artifact';
import { BaseRepository } from './base-repository';

const SUBMISSION_FEATURE_PROPERTY_ARTIFACT_COLUMNS = [
  'submission_feature_property_artifact_id',
  'submission_feature_id',
  'feature_type_property_id',
  'blueprint_feature_type_property_id',
  'artifact_id'
];

export class SubmissionFeaturePropertyArtifactRepository extends BaseRepository {
  /**
   * Insert a submission_feature_property_artifact row.
   *
   * @param {CreateSubmissionFeaturePropertyArtifact} payload
   * @return {Promise<SubmissionFeaturePropertyArtifact>}
   * @memberof SubmissionFeaturePropertyArtifactRepository
   */
  async insertSubmissionFeaturePropertyArtifact(
    payload: CreateSubmissionFeaturePropertyArtifact
  ): Promise<SubmissionFeaturePropertyArtifact> {
    const knex = getKnex();
    const query = knex('submission_feature_property_artifact')
      .insert(payload)
      .returning(SUBMISSION_FEATURE_PROPERTY_ARTIFACT_COLUMNS);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyArtifactSchema);

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Failed to insert submission_feature_property_artifact', [
        'SubmissionFeaturePropertyArtifactRepository->insertSubmissionFeaturePropertyArtifact',
        `rowCount was ${response.rowCount}, expected 1`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get a submission_feature_property_artifact row by id.
   *
   * @param {number} submissionFeaturePropertyArtifactId
   * @return {Promise<SubmissionFeaturePropertyArtifact>}
   * @memberof SubmissionFeaturePropertyArtifactRepository
   */
  async getSubmissionFeaturePropertyArtifactById(
    submissionFeaturePropertyArtifactId: number
  ): Promise<SubmissionFeaturePropertyArtifact> {
    const knex = getKnex();
    const query = knex('submission_feature_property_artifact')
      .select(SUBMISSION_FEATURE_PROPERTY_ARTIFACT_COLUMNS)
      .where('submission_feature_property_artifact_id', submissionFeaturePropertyArtifactId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyArtifactSchema);

    if (response.rowCount === 0) {
      throw new ApiNotFoundError('submission_feature_property_artifact not found', [
        'SubmissionFeaturePropertyArtifactRepository->getSubmissionFeaturePropertyArtifactById',
        { submissionFeaturePropertyArtifactId }
      ]);
    }

    if (response.rowCount !== 1) {
      throw new ApiExecuteSQLError('Unexpected row count', [
        'SubmissionFeaturePropertyArtifactRepository->getSubmissionFeaturePropertyArtifactById',
        `expected rowCount=1, actual rowCount=${response.rowCount}`
      ]);
    }

    return response.rows[0];
  }

  /**
   * Get submission_feature_property_artifact rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyArtifactRepository
   */
  async getSubmissionFeaturePropertyArtifactsBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyArtifact[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_artifact')
      .select(SUBMISSION_FEATURE_PROPERTY_ARTIFACT_COLUMNS)
      .where('submission_feature_id', submissionFeatureId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyArtifactSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_artifact rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyArtifactRepository
   */
  async getSubmissionFeaturePropertyArtifactsByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyArtifact[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_artifact')
      .select(SUBMISSION_FEATURE_PROPERTY_ARTIFACT_COLUMNS)
      .where('feature_type_property_id', featureTypePropertyId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyArtifactSchema);

    return response.rows;
  }

  /**
   * Get submission_feature_property_artifact rows by artifact id.
   *
   * @param {string} artifactId
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyArtifactRepository
   */
  async getSubmissionFeaturePropertyArtifactsByArtifactId(
    artifactId: string
  ): Promise<SubmissionFeaturePropertyArtifact[]> {
    const knex = getKnex();
    const query = knex('submission_feature_property_artifact')
      .select(SUBMISSION_FEATURE_PROPERTY_ARTIFACT_COLUMNS)
      .where('artifact_id', artifactId);

    const response = await this.connection.knex(query, SubmissionFeaturePropertyArtifactSchema);

    return response.rows;
  }
}

import { IDBConnection } from '../database/db';
import {
  CreateSubmissionFeaturePropertyArtifact,
  SubmissionFeaturePropertyArtifact
} from '../models/submission-feature-property-artifact';
import { SubmissionFeaturePropertyArtifactRepository } from '../repositories/submission-feature-property-artifact-repository';
import { DBService } from './db-service';

export class SubmissionFeaturePropertyArtifactService extends DBService {
  submissionFeaturePropertyArtifactRepository: SubmissionFeaturePropertyArtifactRepository;

  /**
   * Creates an instance of SubmissionFeaturePropertyArtifactService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeaturePropertyArtifactService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeaturePropertyArtifactRepository = new SubmissionFeaturePropertyArtifactRepository(connection);
  }

  /**
   * Create a submission_feature_property_artifact row.
   *
   * @param {CreateSubmissionFeaturePropertyArtifact} payload
   * @return {Promise<SubmissionFeaturePropertyArtifact>}
   * @memberof SubmissionFeaturePropertyArtifactService
   */
  createSubmissionFeaturePropertyArtifact(
    payload: CreateSubmissionFeaturePropertyArtifact
  ): Promise<SubmissionFeaturePropertyArtifact> {
    return this.submissionFeaturePropertyArtifactRepository.insertSubmissionFeaturePropertyArtifact(payload);
  }

  /**
   * Get a submission_feature_property_artifact row by id.
   *
   * @param {number} submissionFeaturePropertyArtifactId
   * @return {Promise<SubmissionFeaturePropertyArtifact>}
   * @memberof SubmissionFeaturePropertyArtifactService
   */
  getSubmissionFeaturePropertyArtifactById(
    submissionFeaturePropertyArtifactId: number
  ): Promise<SubmissionFeaturePropertyArtifact> {
    return this.submissionFeaturePropertyArtifactRepository.getSubmissionFeaturePropertyArtifactById(
      submissionFeaturePropertyArtifactId
    );
  }

  /**
   * Get submission_feature_property_artifact rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyArtifactService
   */
  getSubmissionFeaturePropertyArtifactsBySubmissionFeatureId(
    submissionFeatureId: number
  ): Promise<SubmissionFeaturePropertyArtifact[]> {
    return this.submissionFeaturePropertyArtifactRepository.getSubmissionFeaturePropertyArtifactsBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_property_artifact rows by feature type property id.
   *
   * @param {number} featureTypePropertyId
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyArtifactService
   */
  getSubmissionFeaturePropertyArtifactsByFeatureTypePropertyId(
    featureTypePropertyId: number
  ): Promise<SubmissionFeaturePropertyArtifact[]> {
    return this.submissionFeaturePropertyArtifactRepository.getSubmissionFeaturePropertyArtifactsByFeatureTypePropertyId(
      featureTypePropertyId
    );
  }

  /**
   * Get submission_feature_property_artifact rows by artifact id.
   *
   * @param {string} artifactId
   * @return {Promise<SubmissionFeaturePropertyArtifact[]>}
   * @memberof SubmissionFeaturePropertyArtifactService
   */
  getSubmissionFeaturePropertyArtifactsByArtifactId(artifactId: string): Promise<SubmissionFeaturePropertyArtifact[]> {
    return this.submissionFeaturePropertyArtifactRepository.getSubmissionFeaturePropertyArtifactsByArtifactId(
      artifactId
    );
  }
}

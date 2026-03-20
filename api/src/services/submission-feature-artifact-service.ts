import { IDBConnection } from '../database/db';
import { CreateSubmissionFeatureArtifact, SubmissionFeatureArtifact } from '../models/submission-feature-artifact';
import { SubmissionFeatureArtifactRepository } from '../repositories/submission-feature-artifact-repository';
import { DBService } from './db-service';

export class SubmissionFeatureArtifactService extends DBService {
  submissionFeatureArtifactRepository: SubmissionFeatureArtifactRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureArtifactRepository = new SubmissionFeatureArtifactRepository(connection);
  }

  /**
   * Create submission_feature_artifact rows in bulk.
   *
   * @param {CreateSubmissionFeatureArtifact[]} payloads
   * @return {Promise<SubmissionFeatureArtifact[]>}
   * @memberof SubmissionFeatureArtifactService
   */
  createSubmissionFeatureArtifacts(payloads: CreateSubmissionFeatureArtifact[]): Promise<SubmissionFeatureArtifact[]> {
    return this.submissionFeatureArtifactRepository.insertSubmissionFeatureArtifacts(payloads);
  }

  /**
   * Get submission_feature_artifact rows by submission feature id.
   *
   * @param {number} submissionFeatureId
   * @return {Promise<SubmissionFeatureArtifact[]>}
   * @memberof SubmissionFeatureArtifactService
   */
  getSubmissionFeatureArtifactsBySubmissionFeatureId(submissionFeatureId: number): Promise<SubmissionFeatureArtifact[]> {
    return this.submissionFeatureArtifactRepository.getSubmissionFeatureArtifactsBySubmissionFeatureId(
      submissionFeatureId
    );
  }

  /**
   * Get submission_feature_artifact rows by artifact id.
   *
   * @param {string} artifactId
   * @return {Promise<SubmissionFeatureArtifact[]>}
   * @memberof SubmissionFeatureArtifactService
   */
  getSubmissionFeatureArtifactsByArtifactId(artifactId: string): Promise<SubmissionFeatureArtifact[]> {
    return this.submissionFeatureArtifactRepository.getSubmissionFeatureArtifactsByArtifactId(artifactId);
  }

  /**
   * Delete submission_feature_artifact rows by submission id.
   *
   * @param {number} submissionId
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactService
   */
  deleteSubmissionFeatureArtifactsBySubmissionId(submissionId: number): Promise<void> {
    return this.submissionFeatureArtifactRepository.deleteSubmissionFeatureArtifactsBySubmissionId(submissionId);
  }

  /**
   * Delete submission_feature_artifact rows by submission upload id.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactService
   */
  deleteSubmissionFeatureArtifactsBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeatureArtifactRepository.deleteSubmissionFeatureArtifactsBySubmissionUploadId(
      submissionUploadId
    );
  }
}

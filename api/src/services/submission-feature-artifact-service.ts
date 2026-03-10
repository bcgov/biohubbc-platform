import { IDBConnection } from '../database/db';
import { CreateSubmissionFeatureArtifact } from '../models/submission-feature-artifact';
import { SubmissionFeatureArtifactRepository } from '../repositories/submission-feature-artifact-repository';
import { DBService } from './db-service';

export class SubmissionFeatureArtifactService extends DBService {
  submissionFeatureArtifactRepository: SubmissionFeatureArtifactRepository;

  /**
   * Creates an instance of SubmissionFeatureArtifactService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeatureArtifactService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureArtifactRepository = new SubmissionFeatureArtifactRepository(connection);
  }

  /**
   * Bulk insert explicit submission_feature -> artifact links.
   *
   * @param {CreateSubmissionFeatureArtifact[]} submissionFeatureArtifacts
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactService
   */
  async insertSubmissionFeatureArtifacts(submissionFeatureArtifacts: CreateSubmissionFeatureArtifact[]): Promise<void> {
    return this.submissionFeatureArtifactRepository.insertSubmissionFeatureArtifacts(submissionFeatureArtifacts);
  }

  /**
   * Soft-delete submission_feature_artifact links by submission_upload_id.
   *
   * @param {string} submissionUploadId
   * @return {Promise<void>}
   * @memberof SubmissionFeatureArtifactService
   */
  async softDeleteBySubmissionUploadId(submissionUploadId: string): Promise<void> {
    return this.submissionFeatureArtifactRepository.softDeleteBySubmissionUploadId(submissionUploadId);
  }
}

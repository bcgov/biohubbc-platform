import { IDBConnection } from '../database/db';
import { SubmissionFeatureRepository } from '../repositories/submission-feature-repository';
import { SubmissionFeature, SubmissionFeatureRecord } from '../repositories/submission-repository';
import { DBService } from './db-service';

/**
 * Service for submission-feature scoped operations.
 *
 * @export
 * @class SubmissionFeatureService
 * @extends {DBService}
 */
export class SubmissionFeatureService extends DBService {
  submissionFeatureRepository: SubmissionFeatureRepository;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureRepository = new SubmissionFeatureRepository(connection);
  }

  /**
   * Get a submission feature record by uuid.
   *
   * @param {string} submissionFeatureUuid
   * @returns {Promise<SubmissionFeatureRecord>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureByUuid(submissionFeatureUuid: string): Promise<SubmissionFeatureRecord> {
    return this.submissionFeatureRepository.getSubmissionFeatureByUuid(submissionFeatureUuid);
  }

  /**
   * Get a submission feature record by id.
   *
   * @param {number} submissionFeatureId
   * @returns {Promise<SubmissionFeature>}
   * @memberof SubmissionFeatureService
   */
  async getSubmissionFeatureById(submissionFeatureId: number): Promise<SubmissionFeature> {
    return this.submissionFeatureRepository.getSubmissionFeatureById(submissionFeatureId);
  }

  /**
   * Count features owned by an upload that have ever been activated.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<number>} Number of upload-owned features with an effective date.
   * @memberof SubmissionFeatureService
   */
  async getActivatedSubmissionFeatureCountBySubmissionUploadId(submissionUploadId: string): Promise<number> {
    return this.submissionFeatureRepository.getActivatedSubmissionFeatureCountBySubmissionUploadId(submissionUploadId);
  }

  /**
   * Count features in a submission that have ever been activated.
   *
   * @param {number} submissionId Submission identifier.
   * @returns {Promise<number>} Number of submission features with an effective date.
   * @memberof SubmissionFeatureService
   */
  async getActivatedSubmissionFeatureCountBySubmissionId(submissionId: number): Promise<number> {
    return this.submissionFeatureRepository.getActivatedSubmissionFeatureCountBySubmissionId(submissionId);
  }
}

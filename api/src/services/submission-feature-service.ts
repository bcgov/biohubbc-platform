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
   * Get any feature row owned by an upload for administrative review.
   *
   * @param {number} submissionId ID of the submission that owns the upload.
   * @param {string} submissionUploadId UUID of the submission upload.
   * @param {number} submissionFeatureId ID of the feature to return.
   * @returns {Promise<SubmissionFeature>} The requested submission feature.
   * @memberof SubmissionFeatureService
   */
  async getSubmissionUploadFeature(
    submissionId: number,
    submissionUploadId: string,
    submissionFeatureId: number
  ): Promise<SubmissionFeature> {
    return this.submissionFeatureRepository.getSubmissionUploadFeature(
      submissionId,
      submissionUploadId,
      submissionFeatureId
    );
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

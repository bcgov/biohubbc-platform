import { IDBConnection } from '../../database/db';
import {
  CreateSubmissionUploadFeature,
  SubmissionUploadFeature,
  UpdateSubmissionUploadFeature
} from '../../models/submission-upload-feature';
import { SubmissionUploadFeatureRepository } from '../../repositories/reconciliation/submission-upload-feature-repository';
import { DBService } from '../db-service';

/**
 * Service for retained parsed submission upload feature records.
 *
 * Submitted feature content is immutable and intentionally has no delete operation.
 * Only derived reconciliation fields may be updated after insertion.
 *
 * @export
 * @class SubmissionUploadFeatureService
 * @extends {DBService}
 */
export class SubmissionUploadFeatureService extends DBService {
  submissionUploadFeatureRepository: SubmissionUploadFeatureRepository;

  /**
   * Create a submission upload feature service.
   *
   * @param {IDBConnection} connection Active database connection.
   * @memberof SubmissionUploadFeatureService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadFeatureRepository = new SubmissionUploadFeatureRepository(connection);
  }

  /**
   * Insert an immutable parsed submission upload feature.
   *
   * @param {CreateSubmissionUploadFeature} data Submitted feature fields.
   * @returns {Promise<SubmissionUploadFeature>} The inserted upload feature.
   * @memberof SubmissionUploadFeatureService
   */
  async insertSubmissionUploadFeature(data: CreateSubmissionUploadFeature): Promise<SubmissionUploadFeature> {
    return this.submissionUploadFeatureRepository.insertSubmissionUploadFeature(data);
  }

  /**
   * Get a submission upload feature by its primary key.
   *
   * @param {string} submissionUploadFeatureId Submission upload feature identifier.
   * @returns {Promise<SubmissionUploadFeature>} The matching upload feature.
   * @memberof SubmissionUploadFeatureService
   */
  async getSubmissionUploadFeature(submissionUploadFeatureId: string): Promise<SubmissionUploadFeature> {
    return this.submissionUploadFeatureRepository.getSubmissionUploadFeature(submissionUploadFeatureId);
  }

  /**
   * Get all retained features belonging to a submission upload.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadFeature[]>} The upload's staged features.
   * @memberof SubmissionUploadFeatureService
   */
  async getSubmissionUploadFeaturesForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<SubmissionUploadFeature[]> {
    return this.submissionUploadFeatureRepository.getSubmissionUploadFeaturesForSubmissionUploadId(submissionUploadId);
  }

  /**
   * Update only the derived reconciliation fields for an upload feature.
   *
   * @param {string} submissionUploadFeatureId Submission upload feature identifier.
   * @param {UpdateSubmissionUploadFeature} data Derived reconciliation fields to update.
   * @returns {Promise<SubmissionUploadFeature>} The updated upload feature.
   * @memberof SubmissionUploadFeatureService
   */
  async updateSubmissionUploadFeature(
    submissionUploadFeatureId: string,
    data: UpdateSubmissionUploadFeature
  ): Promise<SubmissionUploadFeature> {
    return this.submissionUploadFeatureRepository.updateSubmissionUploadFeature(submissionUploadFeatureId, data);
  }
}

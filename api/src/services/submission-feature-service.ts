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
   * Un-publish the upload's live features by clearing record_effective_date.
   *
   * Used when an upload is denied or returned to the submitted state. Rows ended by
   * reconciliation are never resurrected. A no-op (zero rows) for uploads whose rows are
   * already pending.
   *
   * @param {string} submissionUploadId The submission upload scope.
   * @returns {Promise<number>} Number of rows un-published.
   * @memberof SubmissionFeatureService
   */
  async unpublishLiveSubmissionFeaturesBySubmissionUploadId(submissionUploadId: string): Promise<number> {
    return this.submissionFeatureRepository.unpublishLiveSubmissionFeaturesBySubmissionUploadId(submissionUploadId);
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
}

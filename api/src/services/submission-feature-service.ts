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
}

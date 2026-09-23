import { IDBConnection } from '../database/db';
import { SubmissionFeatureSecurityRepository } from '../repositories/submission-feature-security-repository';
import { DBService } from './db-service';

/** Validates and normalizes feature-security operations before delegating persistence. */
export class SubmissionFeatureSecurityService extends DBService {
  submissionFeatureSecurityRepository: SubmissionFeatureSecurityRepository;
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureSecurityRepository = new SubmissionFeatureSecurityRepository(connection);
  }

  /**
   * Copy live predecessor rules to pending successor occurrences, preserving provenance.
   *
   * @param {string} submissionUploadId Pending successor upload identifier.
   * @param {string | null} predecessorSubmissionUploadId Preferred pending predecessor upload identifier.
   * @returns {Promise<void>} Resolves after missing inherited assignments have been inserted.
   * @memberof SubmissionFeatureSecurityService
   */
  async copySubmissionFeatureSecurityToSuccessors(
    submissionUploadId: string,
    predecessorSubmissionUploadId: string | null
  ): Promise<void> {
    await this.submissionFeatureSecurityRepository.copySubmissionFeatureSecurityToSuccessors(
      submissionUploadId,
      predecessorSubmissionUploadId
    );
  }
}

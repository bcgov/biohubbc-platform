import { IDBConnection } from '../../database/db';
import { HTTP500 } from '../../errors/http-error';
import { ReconciliationCounts, SubmissionUploadReconciliation } from '../../models/reconciliation';
import { SubmissionFeatureReconciliationRepository } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';

const defaultLog = getLogger('services/reconciliation/submission-upload-reconciliation-service');

/** Coordinates classification and atomic publication of upload-owned feature rows. */
export class SubmissionUploadReconciliationService extends DBService {
  submissionFeatureReconciliationRepository: SubmissionFeatureReconciliationRepository;
  submissionRepository: SubmissionRepository;
  submissionUploadRepository: SubmissionUploadRepository;

  /**
   * Create a submission upload reconciliation service.
   *
   * @param {IDBConnection} connection Database connection used by the coordinated repositories and services.
   * @memberof SubmissionUploadReconciliationService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureReconciliationRepository = new SubmissionFeatureReconciliationRepository(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
  }

  /**
   * Validate uploaded feature source identifiers before reconciliation.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<number>} Number of feature occurrences with an invalid source identifier.
   * @memberof SubmissionUploadReconciliationService
   */
  async validateSubmissionFeatureSourceIdentity(submissionUploadId: string): Promise<number> {
    await this.submissionFeatureReconciliationRepository.deleteSourceIdentityErrors(submissionUploadId);
    return this.submissionFeatureReconciliationRepository.insertSourceIdentityErrors(submissionUploadId);
  }

  /**
   * Classify an upload's pending feature rows against current published state.
   *
   * Acquires the submission feature-state lock before deriving current published predecessors by
   * `(submission_id, source_id)` and persisting reconciliation outcomes. No successor links are
   * written in this phase.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<SubmissionUploadReconciliation>} Pending predecessor upload used as the baseline.
   * @memberof SubmissionUploadReconciliationService
   */
  async reconcileSubmissionFeatures(submissionUploadId: string): Promise<SubmissionUploadReconciliation> {
    const upload = await this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
    const predecessorSubmissionUploadId =
      await this.submissionFeatureReconciliationRepository.getPredecessorSubmissionUploadId(
        submissionUploadId,
        upload.submission_id
      );
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(upload.submission_id);
    await this.submissionFeatureReconciliationRepository.reconcileSubmissionFeatures(
      submissionUploadId,
      upload.submission_id,
      predecessorSubmissionUploadId
    );
    return { predecessorSubmissionUploadId };
  }

  /**
   * End pending feature occurrences after their upload has been superseded.
   *
   * @param {string} submissionUploadId Superseded submission upload identifier.
   * @returns {Promise<void>} Resolves after pending occurrences are ended.
   * @memberof SubmissionUploadReconciliationService
   */
  async endPendingSubmissionFeatures(submissionUploadId: string): Promise<void> {
    await this.submissionFeatureReconciliationRepository.endPendingSubmissionFeatures(submissionUploadId);
  }

  /**
   * Publish the reconciliation result stored during initial intake.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<ReconciliationCounts>} Stored reconciliation counts applied during approval.
   * @throws {HTTP500} When classified and activated feature counts diverge.
   * @memberof SubmissionUploadReconciliationService
   */
  async activateSubmissionUploadReconciliation(submissionUploadId: string): Promise<ReconciliationCounts> {
    const upload = await this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(upload.submission_id);

    const counts = await this.submissionFeatureReconciliationRepository.getSubmissionFeatureReconciliationCounts(
      submissionUploadId
    );

    await this.submissionFeatureReconciliationRepository.linkReconciledSubmissionFeaturePredecessors(
      submissionUploadId,
      upload.submission_id
    );
    const activated = await this.submissionFeatureReconciliationRepository.activateReconciledSubmissionFeatures(
      submissionUploadId,
      upload.submission_id
    );
    this.assertSubmissionFeatureActivationCount(counts, activated);

    defaultLog.info({
      label: 'activateSubmissionUploadReconciliation',
      message: 'Submission upload features activated',
      submissionUploadId,
      submissionId: upload.submission_id,
      counts
    });
    return counts;
  }

  /**
   * Assert that publication applied every reconciled lifecycle transition exactly once.
   *
   * @param {ReconciliationCounts} reconciliationCounts Classified new, modified, and unmodified feature counts.
   * @param {number} activated Applied feature activation count.
   * @returns {void} Returns after confirming the applied lifecycle counts match reconciliation.
   * @throws {HTTP500} When applied lifecycle counts diverge from the reconciliation classification.
   * @memberof SubmissionUploadReconciliationService
   */
  private assertSubmissionFeatureActivationCount(reconciliationCounts: ReconciliationCounts, activated: number): void {
    const expectedActivated =
      reconciliationCounts.new + reconciliationCounts.modified + reconciliationCounts.unmodified;

    if (activated !== expectedActivated) {
      throw new HTTP500('Applied feature lifecycle counts diverged from reconciliation', [
        `expectedActivated=${expectedActivated}, activated=${activated}`
      ]);
    }
  }
}

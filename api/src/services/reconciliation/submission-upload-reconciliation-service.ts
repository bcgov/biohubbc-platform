import { IDBConnection } from '../../database/db';
import { HTTP409, HTTP500 } from '../../errors/http-error';
import { ReconciliationCounts } from '../../models/reconciliation';
import { SubmissionUploadFeatureRepository } from '../../repositories/reconciliation/submission-upload-feature-repository';
import { SubmissionUploadReconciliationRepository } from '../../repositories/reconciliation/submission-upload-reconciliation-repository';
import { SubmissionFeatureErrorRepository } from '../../repositories/submission-feature-error-repository';
import { SubmissionFeatureRepository } from '../../repositories/submission-feature-repository';
import { SubmissionRepository } from '../../repositories/submission-repository';
import { SubmissionUploadRepository } from '../../repositories/upload/submission-upload-repository';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';

const defaultLog = getLogger('services/reconciliation/submission-upload-reconciliation-service');

/**
 * Coordinates durable classification, promotion, and atomic publication.
 *
 * @export
 * @class SubmissionUploadReconciliationService
 * @extends {DBService}
 */
export class SubmissionUploadReconciliationService extends DBService {
  submissionUploadFeatureRepository: SubmissionUploadFeatureRepository;
  submissionUploadReconciliationRepository: SubmissionUploadReconciliationRepository;
  submissionFeatureRepository: SubmissionFeatureRepository;
  submissionFeatureErrorRepository: SubmissionFeatureErrorRepository;
  submissionRepository: SubmissionRepository;
  submissionUploadRepository: SubmissionUploadRepository;

  /**
   * Create a submission upload reconciliation service.
   *
   * @param {IDBConnection} connection Active database connection.
   * @memberof SubmissionUploadReconciliationService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadFeatureRepository = new SubmissionUploadFeatureRepository(connection);
    this.submissionUploadReconciliationRepository = new SubmissionUploadReconciliationRepository(connection);
    this.submissionFeatureRepository = new SubmissionFeatureRepository(connection);
    this.submissionFeatureErrorRepository = new SubmissionFeatureErrorRepository(connection);
    this.submissionRepository = new SubmissionRepository(connection);
    this.submissionUploadRepository = new SubmissionUploadRepository(connection);
  }

  /**
   * Read and unwrap the SQL-built reconciliation summary.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<ReconciliationCounts | null>} Persisted counts, or null when absent.
   * @memberof SubmissionUploadReconciliationService
   */
  async getSubmissionUploadReconciliationCountsForSubmissionUploadId(
    submissionUploadId: string
  ): Promise<ReconciliationCounts | null> {
    const summary = await this.submissionUploadReconciliationRepository.getSubmissionUploadReconciliationCounts(
      submissionUploadId
    );

    return summary.reconciliation;
  }

  /**
   * Classify retained upload features and persist the complete reconciliation summary.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<ReconciliationCounts>} Prepared reconciliation counts.
   * @memberof SubmissionUploadReconciliationService
   */
  async reconcileSubmissionUploadFeatures(submissionUploadId: string): Promise<ReconciliationCounts> {
    const upload = await this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);

    // Hold the submission-wide feature lock while classifying upload features against the
    // active rows identified by submission ID, feature type ID, and source ID.
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(upload.submission_id);

    // Classification and summary persistence are one deterministic, retry-safe statement.
    const { reconciliation: counts } =
      await this.submissionUploadFeatureRepository.updateSubmissionUploadFeaturesWithReconciliation(
        submissionUploadId,
        upload.submission_id
      );

    // Conflict details also remain in the standard feature-error table because they make the upload invalid.
    await this.submissionFeatureErrorRepository.insertSubmissionFeatureErrorForSubmissionUploadId(submissionUploadId);

    return counts;
  }

  /**
   * Promote exactly the prepared new and superseded rows into pending features.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<number>} Number of promoted and linked features.
   * @throws {HTTP409} If conflicts are present.
   * @throws {HTTP500} If promotion and reconciliation tallies diverge.
   * @memberof SubmissionUploadReconciliationService
   */
  async promoteSubmissionUploadFeatures(submissionUploadId: string): Promise<number> {
    // Promotion may only run after every upload feature has a reconciliation.
    const counts = await this.getSubmissionUploadReconciliationCountsForSubmissionUploadId(submissionUploadId);
    if (!counts) {
      throw new HTTP409('Submission upload has not been reconciled');
    }
    if (counts.conflict > 0) {
      throw new HTTP409('Submission upload contains reconciliation conflicts and cannot be promoted');
    }

    // Copy only new and superseded rows, then link each retained changed row to
    // the pending feature produced from it. Unchanged rows were linked during reconciliation.
    await this.submissionFeatureRepository.insertPendingSubmissionFeaturesForSubmissionUploadId(submissionUploadId);
    await this.submissionUploadFeatureRepository.updateSubmissionFeatureIdsForPromotedFeaturesBySubmissionUploadId(
      submissionUploadId
    );

    // Verify the prepared natural-key rows converged. This also
    // makes a retried promotion safe when the pending rows already exist.
    const { count: promoted } =
      await this.submissionFeatureRepository.getPendingSubmissionFeatureCountForSubmissionUploadId(submissionUploadId);
    const expected = counts.new + counts.superseded;
    if (promoted !== expected) {
      throw new HTTP500('Promoted feature count diverged from reconciliation', [
        `classified=${expected}, promoted=${promoted}`
      ]);
    }
    return promoted;
  }

  /**
   * Atomically publish an indexed upload using the feature natural key.
   *
   * @param {string} submissionUploadId Submission upload identifier.
   * @returns {Promise<ReconciliationCounts>} Applied reconciliation counts.
   * @throws {HTTP409} If the reconciliation contains conflicts.
   * @throws {HTTP500} If lifecycle tallies diverge.
   * @memberof SubmissionUploadReconciliationService
   */
  async activateSubmissionUploadReconciliation(submissionUploadId: string): Promise<ReconciliationCounts> {
    // Stage 1: load the upload scope. Approval is not coupled to the upload's
    // background processing status; reconciliation state determines whether the
    // feature projection is ready to activate.
    const upload = await this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
    // Stage 2: serialize activation with reconciliation and other feature-state writers.
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(upload.submission_id);

    // Stage 3: an `unchanged` classification points to the active row that existed when
    // reconciliation ran. Another upload may since have ended or replaced that exact row.
    // Rejecting that stale snapshot avoids activating changed rows while silently accepting
    // an outdated unchanged baseline.
    const { stale } = await this.submissionUploadFeatureRepository.isSubmissionUploadFeaturesStale(submissionUploadId);
    if (stale) {
      throw new HTTP409('Submission upload reconciliation is stale; submit a new upload');
    }

    // Stage 4: load the durable reconciliation summary and reject conflicts before writes.
    const counts = await this.getSubmissionUploadReconciliationCountsForSubmissionUploadId(submissionUploadId);
    if (!counts) {
      throw new HTTP409('Submission upload has not been reconciled');
    }
    if (counts.conflict > 0) {
      throw new HTTP409('Submission upload contains reconciliation conflicts');
    }

    const changedFeatureCount = counts.new + counts.superseded;

    // An unchanged-only upload does not alter active or derived feature state. Return
    // without lifecycle writes, rebuilding closure, or advancing the submission revision.
    if (changedFeatureCount === 0) {
      return counts;
    }

    // Stage 5: end the currently active row for every changed natural key, then activate
    // or reactivate the promoted rows belonging to this upload. This supports reapproval
    // after revocation and makes concurrent prepared uploads last-approval-wins.
    const { count: replaced } =
      await this.submissionFeatureRepository.deactivateReplacedSubmissionFeaturesForSubmissionUploadId(
        submissionUploadId
      );
    const { count: published } = await this.submissionFeatureRepository.activateSubmissionFeaturesForSubmissionUploadId(
      submissionUploadId
    );
    if (published !== changedFeatureCount) {
      throw new HTTP500('Applied feature lifecycle counts diverged from reconciliation');
    }

    defaultLog.info({
      label: 'activateSubmissionUploadReconciliation',
      message: 'Submission upload reconciliation activated',
      submissionUploadId,
      submissionId: upload.submission_id,
      counts,
      replacedFeatureCount: replaced
    });
    return counts;
  }

  /**
   * Remove an approved patch from the active projection.
   *
   * Only promoted rows that the revoked upload still owns are ended. If a later approved upload
   * already superseded one of those rows, it remains active. Otherwise, the newest effective
   * predecessor for the natural key is restored from immutable feature history.
   *
   * @param {string} submissionUploadId Approved submission upload being revoked.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadReconciliationService
   */
  async revokeSubmissionUploadReconciliation(submissionUploadId: string): Promise<void> {
    const upload = await this.submissionUploadRepository.getSubmissionUpload(submissionUploadId);
    await this.submissionRepository.lockSubmissionFeatureStateForSubmissionId(upload.submission_id);

    const { revokedFeatureCount, restoredFeatureCount } =
      await this.submissionFeatureRepository.revokeSubmissionFeaturesForSubmissionUploadId(submissionUploadId);
    if (revokedFeatureCount === 0) {
      return;
    }

    defaultLog.info({
      label: 'revokeSubmissionUploadReconciliation',
      message: 'Submission upload approval revoked',
      submissionUploadId,
      submissionId: upload.submission_id,
      revokedFeatureCount,
      restoredFeatureCount
    });
  }
}

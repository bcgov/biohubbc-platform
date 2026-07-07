import SQL from 'sql-template-strings';
import {
  SUBMISSION_ACTIVE_STATE_LOCK_PREFIX,
  SUBMISSION_ACTIVE_STATE_LOCK_SEED
} from '../../constants/database-lock-keys';
import { IDBConnection } from '../../database/db';
import { HTTP400, HTTP409, HTTP500 } from '../../errors/http-error';
import { SubmissionFeatureDerivedStateRepository } from '../../repositories/reconciliation/submission-feature-derived-state-repository';
import { SubmissionFeatureLogRepository } from '../../repositories/reconciliation/submission-feature-log-repository';
import { SubmissionFeatureReconciliationRepository } from '../../repositories/reconciliation/submission-feature-reconciliation-repository';
import { getLogger } from '../../utils/logger';
import { DBService } from '../db-service';
import { SubmissionFeatureClosureService } from '../submission-feature-closure-service';
import { SubmissionUploadService } from '../upload/submission-upload-service';

const defaultLog = getLogger('services/reconciliation/submission-feature-reconciliation-service');

/**
 * Per-outcome feature counts for a reconciled upload.
 */
export interface ReconciliationOutcomeCounts {
  new: number;
  unchanged: number;
  superseded: number;
  conflict: number;
}

/**
 * Service that reconciles a submission upload's pending features against the submission's
 * published state and activates the upload.
 *
 * Activation is the publication step of the review workflow: it runs inside the approval
 * request's transaction, so the previous published state stays live until the moment the
 * new state becomes live — an atomic cutover with no search gap and no partial activation
 * (any failure rolls the whole approval back).
 *
 * @export
 * @class SubmissionFeatureReconciliationService
 * @extends {DBService}
 */
export class SubmissionFeatureReconciliationService extends DBService {
  reconciliationRepository: SubmissionFeatureReconciliationRepository;
  derivedStateRepository: SubmissionFeatureDerivedStateRepository;
  submissionFeatureLogRepository: SubmissionFeatureLogRepository;
  submissionUploadService: SubmissionUploadService;
  submissionFeatureClosureService: SubmissionFeatureClosureService;

  /**
   * Creates an instance of SubmissionFeatureReconciliationService.
   *
   * @param {IDBConnection} connection
   * @memberof SubmissionFeatureReconciliationService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.reconciliationRepository = new SubmissionFeatureReconciliationRepository(connection);
    this.derivedStateRepository = new SubmissionFeatureDerivedStateRepository(connection);
    this.submissionFeatureLogRepository = new SubmissionFeatureLogRepository(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
    this.submissionFeatureClosureService = new SubmissionFeatureClosureService(connection);
  }

  /**
   * Reconcile the upload's pending features against the submission's published state and
   * activate the upload, all within the caller's open transaction.
   *
   * Steps, in order:
   * 1. Serialize on the per-submission active-state advisory lock (blocking, xact-scoped).
   * 2. Guards: the upload must be `indexed` (validation passed), and no two live pending
   *    rows may share a `(feature_type_id, source_id)` key.
   * 3. Classify each pending feature as new / unchanged / superseded / conflict and write
   *    the durable per-feature reconciliation records.
   * 4. Soft-end superseded predecessors, soft-end unchanged and conflicted pending
   *    duplicates, then publish the new/superseded rows — in that order, so the
   *    one-published-row-per-key unique index holds at every statement boundary.
   * 5. Record append-only `superseded` rows in submission_feature_log, linking each ended
   *    predecessor to its published replacement. Runs after publication so every log row
   *    describes a completed transition; a unique-index violation (conflicting replacement
   *    chain) or a classified/ended/logged tally mismatch aborts the approval before any
   *    derived-state healing.
   * 6. Heal derived state that referenced superseded rows (parent links, feature
   *    references, content relationships, security scope anchors) and carry active
   *    security rules forward onto replacement rows.
   * 7. Recompute the submission's closure so search and authorization reach reflect the
   *    new active state within the same transaction.
   *
   * Re-approving an already-activated upload is a no-op: classification only considers
   * pending rows, so an upload with no pending rows produces no state changes.
   *
   * @param {string} submissionUploadId The submission upload to activate.
   * @returns {Promise<ReconciliationOutcomeCounts>} Per-outcome feature counts for the upload.
   * @throws {HTTP400} If the upload has not reached the `indexed` status.
   * @throws {HTTP409} If the upload's pending rows contain duplicate reconciliation keys.
   * @throws {HTTP500} If the classified, soft-ended, and logged superseded tallies diverge.
   * @memberof SubmissionFeatureReconciliationService
   */
  async reconcileAndActivateSubmissionUpload(submissionUploadId: string): Promise<ReconciliationOutcomeCounts> {
    const submissionUpload = await this.submissionUploadService.getSubmissionUpload(submissionUploadId);
    const submissionId = submissionUpload.submission_id;

    if (submissionUpload.status !== 'indexed') {
      throw new HTTP400('Submission upload must be fully indexed before approval', [
        `Submission upload status is '${submissionUpload.status}', expected 'indexed'`
      ]);
    }

    // Serialize all writers of this submission's published feature state (concurrent
    // approvals, closure recompute job). Blocking: approval is an explicit admin action
    // and must not silently skip.
    await this.connection.sql(SQL`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${SUBMISSION_ACTIVE_STATE_LOCK_PREFIX} || ':' || ${submissionId}::text, ${SUBMISSION_ACTIVE_STATE_LOCK_SEED})
      );
    `);

    const duplicateKeyRowCount = await this.reconciliationRepository.getPendingDuplicateKeyRowCount(submissionUploadId);
    if (duplicateKeyRowCount > 0) {
      throw new HTTP409('Submission upload contains duplicate feature source ids and cannot be activated', [
        `${duplicateKeyRowCount} pending feature rows share a (feature_type, source_id) key`
      ]);
    }

    await this.reconciliationRepository.deleteReconciliationRecordsBySubmissionUploadId(submissionUploadId);
    const outcomeCountRows = await this.reconciliationRepository.insertReconciliationRecordsFromClassification(
      submissionUploadId,
      submissionId
    );

    const counts: ReconciliationOutcomeCounts = { new: 0, unchanged: 0, superseded: 0, conflict: 0 };
    for (const { outcome, count } of outcomeCountRows) {
      counts[outcome] = count;
    }

    const supersededCount = await this.reconciliationRepository.endSupersededBaselineRows(submissionUploadId);
    const unchangedEndedCount = await this.reconciliationRepository.endUnchangedIncomingRows(submissionUploadId);
    const conflictEndedCount = await this.reconciliationRepository.endConflictIncomingRows(submissionUploadId);
    const publishedCount = await this.reconciliationRepository.publishIncomingRows(submissionUploadId);

    const supersededLogCount = await this.submissionFeatureLogRepository.insertSupersededLogRecordsFromReconciliation(
      submissionUploadId
    );

    // These three tallies derive from the same outcome rows; divergence would permanently
    // record transitions that never happened (log rows are never deleted), so abort on drift.
    if (supersededCount !== counts.superseded || supersededLogCount !== counts.superseded) {
      throw new HTTP500('Superseded feature lifecycle records diverged during approval', [
        `classified=${counts.superseded}, ended=${supersededCount}, logged=${supersededLogCount}`
      ]);
    }

    const parentRepointCount = await this.derivedStateRepository.repointParentLinksToActiveRows(submissionId);
    const referenceRepointCount = await this.derivedStateRepository.repointFeaturePropertyReferencesToActiveRows(
      submissionId
    );
    const relationshipRepointCount = await this.derivedStateRepository.repointFeatureRelationshipsToActiveRows(
      submissionId
    );
    const anchorRepointCount = await this.derivedStateRepository.repointSecurityScopeAnchorsToActiveRows(submissionId);
    const carriedForwardSecurityRuleCount =
      await this.derivedStateRepository.carryForwardSecurityRulesToReplacementRows(submissionUploadId);

    const { insertedCount: closureRowCount } = await this.submissionFeatureClosureService.computeClosureForSubmission(
      submissionId
    );

    defaultLog.info({
      label: 'reconcileAndActivateSubmissionUpload',
      message: 'Submission upload reconciled and activated',
      submissionId,
      submissionUploadId,
      counts,
      supersededCount,
      unchangedEndedCount,
      conflictEndedCount,
      publishedCount,
      supersededLogCount,
      parentRepointCount,
      referenceRepointCount,
      relationshipRepointCount,
      anchorRepointCount,
      carriedForwardSecurityRuleCount,
      closureRowCount
    });

    return counts;
  }
}

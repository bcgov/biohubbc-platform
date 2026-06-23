import { IDBConnection } from '../database/db';
import { SecurityRuleRecord } from '../models/security-rule';
import { SecurityRepository } from '../repositories/security-repository';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';
import { SecurityRuleService } from './security-rule-service';

const defaultLog = getLogger('services/submission-upload-security-service');

/**
 * Orchestrates automatic security screening for a `submission_upload`.
 *
 * Screening is an independent background workflow that runs after `submission_feature_closure`
 * has been populated. It does NOT change `submission_upload.status`; its lifecycle is recorded as
 * an event row in `submission_upload_security`. A run:
 * 1. Inserts a `submission_upload_security` event row in the `started` state.
 * 2. Fetches all screenable security rules (`is_active = true`, not soft-deleted).
 * 3. For each rule, obtains trigger `submission_feature_id` values from the policy evaluator seam
 *    ({@link evaluateTriggerFeatureIds}).
 * 4. Inserts draft `submission_feature_security` rows (linked to the scan event) for the trigger
 *    features and all closure-related features in the same upload.
 * 5. Moves the scan event row to `completed` (or `failed` via {@link recordScreeningFailure}).
 *
 * @export
 * @class SubmissionUploadSecurityService
 * @extends {DBService}
 */
export class SubmissionUploadSecurityService extends DBService {
  submissionUploadSecurityRepository: SubmissionUploadSecurityRepository;
  securityRepository: SecurityRepository;
  securityRuleService: SecurityRuleService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadSecurityRepository = new SubmissionUploadSecurityRepository(connection);
    this.securityRepository = new SecurityRepository(connection);
    this.securityRuleService = new SecurityRuleService(connection);
  }

  /**
   * Evaluate a security rule against an upload and return the `submission_feature_id`
   * values of features that trigger the rule (i.e. match the rule's policy).
   *
   * **This is a stub.** The policy evaluator is intentionally out of scope for this
   * ticket. The seam is here so the full job pipeline (scan-event lifecycle, closure
   * join, draft insert, idempotency) can be wired and tested end-to-end. A future
   * ticket will replace this stub with a real implementation that:
   *
   * - Reads the rule's `policy_id` and associated `security_rule_expression`.
   * - Loads the policy's `policy_statement` rows to determine the eligible feature types.
   * - Evaluates the expression tree (including geometry conditions like `ST_Intersects`)
   *   against the eligible features in the upload using the existing evaluator in
   *   `api/src/repositories/expression-evaluation.ts`.
   * - Returns the `submission_feature_id` values of matching features.
   *
   * **Contract when `policy_id` is null:** A rule with no linked policy cannot be evaluated
   * against upload features, so the real implementation must return `[]` for such rules.
   *
   * @param {SecurityRuleRecord} _rule The security rule to evaluate.
   * @param {string} _submissionUploadId The upload to evaluate against.
   * @returns {Promise<number[]>} IDs of features that trigger the rule. Stub returns [].
   * @memberof SubmissionUploadSecurityService
   */
  // TODO: implement policy evaluator — replace stub with expression-evaluation.ts integration
  async evaluateTriggerFeatureIds(_rule: SecurityRuleRecord, _submissionUploadId: string): Promise<number[]> {
    return [];
  }

  /**
   * Run automatic security screening for a single `submission_upload`.
   *
   * Records a `submission_upload_security` event row (`started` → `completed`), evaluating every
   * screenable rule and inserting draft `submission_feature_security` rows (linked to the event)
   * for any matched features and their closure-related neighbours.
   *
   * The draft insert is idempotent (`ON CONFLICT DO NOTHING`), so re-screening an upload skips
   * features already covered by an existing record.
   *
   * @param {string} submissionUploadId UUID of the upload to screen.
   * @param {number} submissionId Submission ID (for log context only).
   * @param {(string | null)} jobId The pg-boss job id (recorded on the scan event for resync).
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityService
   */
  async screenSubmissionUpload(submissionUploadId: string, submissionId: number, jobId: string | null): Promise<void> {
    defaultLog.debug({
      label: 'screenSubmissionUpload',
      message: 'Starting automatic security screening',
      submissionUploadId,
      submissionId
    });

    const submissionUploadSecurityId = await this.submissionUploadSecurityRepository.insertScanEvent(
      submissionUploadId,
      jobId
    );

    const rules = await this.securityRuleService.getScreenableSecurityRules();

    defaultLog.debug({
      label: 'screenSubmissionUpload',
      message: `Evaluating ${rules.length} screenable rule(s)`,
      submissionUploadId,
      submissionId,
      ruleCount: rules.length
    });

    let insertedCount = 0;

    for (const rule of rules) {
      const triggerIds = await this.evaluateTriggerFeatureIds(rule, submissionUploadId);

      if (triggerIds.length === 0) {
        defaultLog.debug({
          label: 'screenSubmissionUpload',
          message: 'No trigger features for rule — skipping',
          submissionUploadId,
          securityRuleId: rule.security_rule_id,
          ruleName: rule.name
        });
        continue;
      }

      const ruleInsertedCount = await this.securityRepository.insertDraftSecurityForTriggers(
        triggerIds,
        rule.security_rule_id,
        submissionUploadId,
        submissionUploadSecurityId
      );

      insertedCount += ruleInsertedCount;

      defaultLog.info({
        label: 'screenSubmissionUpload',
        message: 'Inserted draft security records',
        submissionUploadId,
        submissionId,
        securityRuleId: rule.security_rule_id,
        ruleName: rule.name,
        triggerCount: triggerIds.length,
        insertedCount: ruleInsertedCount
      });
    }

    await this.submissionUploadSecurityRepository.updateScanEventStatus(submissionUploadSecurityId, 'completed', {
      ruleCount: rules.length,
      insertedCount
    });

    defaultLog.info({
      label: 'screenSubmissionUpload',
      message: 'Automatic security screening complete',
      submissionUploadId,
      submissionId,
      insertedCount
    });
  }

  /**
   * Record a permanently-failed screening attempt as a `failed` scan event row.
   *
   * Called by the dead-letter handler after pg-boss has exhausted retries. Because each screening
   * attempt runs in a single transaction that rolls back on error, no partial `started` row
   * survives a failure — so this inserts a fresh event row and immediately marks it `failed` for
   * operator visibility.
   *
   * @param {string} submissionUploadId UUID of the upload whose screening failed.
   * @param {(string | null)} jobId The pg-boss job id, if available.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityService
   */
  async recordScreeningFailure(submissionUploadId: string, jobId: string | null): Promise<void> {
    const submissionUploadSecurityId = await this.submissionUploadSecurityRepository.insertScanEvent(
      submissionUploadId,
      jobId
    );

    await this.submissionUploadSecurityRepository.updateScanEventStatus(submissionUploadSecurityId, 'failed');
  }
}

import { IDBConnection } from '../database/db';
import { SecurityRuleRecord } from '../models/security-rule';
import { AutomaticSecurityScreeningRepository } from '../repositories/automatic-security-screening-repository';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';
import { SecurityRuleService } from './security-rule-service';
import { SubmissionUploadService } from './upload/submission-upload-service';

const defaultLog = getLogger('services/automatic-security-screening-service');

/**
 * Orchestrates automatic security screening for a `submission_upload`.
 *
 * Screening runs after `submission_feature_closure` has been populated and:
 * 1. Transitions the upload to `security_screening`.
 * 2. Fetches all screenable security rules (`is_active = true`, not soft-deleted).
 * 3. For each rule, obtains trigger `submission_feature_id` values from the policy
 *    evaluator seam ({@link evaluateTriggerFeatureIds}).
 * 4. Inserts draft `submission_feature_security` rows for the trigger features and all
 *    closure-related features in the same upload.
 * 5. Transitions the upload to `security_screened`.
 *
 * @export
 * @class AutomaticSecurityScreeningService
 * @extends {DBService}
 */
export class AutomaticSecurityScreeningService extends DBService {
  screeningRepository: AutomaticSecurityScreeningRepository;
  securityRuleService: SecurityRuleService;
  submissionUploadService: SubmissionUploadService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.screeningRepository = new AutomaticSecurityScreeningRepository(connection);
    this.securityRuleService = new SecurityRuleService(connection);
    this.submissionUploadService = new SubmissionUploadService(connection);
  }

  /**
   * Evaluate a security rule against an upload and return the `submission_feature_id`
   * values of features that trigger the rule (i.e. match the rule's policy).
   *
   * **This is a stub.** The policy evaluator is intentionally out of scope for this
   * ticket. The seam is here so the full job pipeline (status transitions, closure
   * join, draft insert, idempotency) can be wired and tested end-to-end. A future
   * ticket will replace this stub with a real implementation that:
   *
   * - Reads the rule's `policy_id` and associated `security_rule_expression`.
   * - Loads the policy's `policy_statement` rows to determine the eligible
   *   feature types (e.g. `feature_type IN (telemetry, observation, sample_site)`).
   * - Evaluates the expression tree (including geometry conditions like
   *   `ST_Intersects`) against the eligible features in the upload using the
   *   existing evaluator in `api/src/repositories/expression-evaluation.ts`.
   * - Returns the `submission_feature_id` values of matching features.
   *
   * **Contract when `policy_id` is null:** A rule with no linked policy cannot be
   * evaluated against upload features, so the real implementation must return `[]`
   * for such rules (effectively skipping them). Rules without a policy should never
   * reach a screenable state in practice, but the evaluator must handle the case
   * gracefully rather than throwing.
   *
   * @param {SecurityRuleRecord} _rule The security rule to evaluate.
   * @param {string} _submissionUploadId The upload to evaluate against.
   * @returns {Promise<number[]>} IDs of features that trigger the rule. Stub returns [].
   *   When `_rule.policy_id` is null the real implementation must also return [].
   * @memberof AutomaticSecurityScreeningService
   */
  // TODO: implement policy evaluator — replace stub with expression-evaluation.ts integration
  async evaluateTriggerFeatureIds(_rule: SecurityRuleRecord, _submissionUploadId: string): Promise<number[]> {
    return [];
  }

  /**
   * Run automatic security screening for a single `submission_upload`.
   *
   * Transitions the upload through `security_screening` → `security_screened`,
   * evaluating every screenable rule and inserting draft `submission_feature_security`
   * rows for any matched features and their closure-related neighbours.
   *
   * The method is idempotent: re-running it for an upload that has already been
   * screened will skip any features already covered by an existing record
   * (`ON CONFLICT DO NOTHING` in the repository insert).
   *
   * @param {string} submissionUploadId UUID of the upload to screen.
   * @param {number} submissionId Submission ID (for log context only).
   * @returns {Promise<void>}
   * @memberof AutomaticSecurityScreeningService
   */
  async screenSubmissionUpload(submissionUploadId: string, submissionId: number): Promise<void> {
    defaultLog.debug({
      label: 'screenSubmissionUpload',
      message: 'Starting automatic security screening',
      submissionUploadId,
      submissionId
    });

    await this.submissionUploadService.transitionSubmissionUploadToSecurityScreening(submissionUploadId);

    const rules = await this.securityRuleService.getScreenableSecurityRules();

    defaultLog.debug({
      label: 'screenSubmissionUpload',
      message: `Evaluating ${rules.length} screenable rule(s)`,
      submissionUploadId,
      submissionId,
      ruleCount: rules.length
    });

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

      const insertedCount = await this.screeningRepository.insertDraftSecurityForTriggers(
        triggerIds,
        rule.security_rule_id,
        submissionUploadId
      );

      defaultLog.info({
        label: 'screenSubmissionUpload',
        message: 'Inserted draft security records',
        submissionUploadId,
        submissionId,
        securityRuleId: rule.security_rule_id,
        ruleName: rule.name,
        triggerCount: triggerIds.length,
        insertedCount
      });
    }

    await this.submissionUploadService.transitionSubmissionUploadToSecurityScreened(submissionUploadId);

    defaultLog.info({
      label: 'screenSubmissionUpload',
      message: 'Automatic security screening complete',
      submissionUploadId,
      submissionId
    });
  }
}

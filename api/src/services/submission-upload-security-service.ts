import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { NormalizedSecurityRuleExpression } from '../models/submission-feature-security';
import { SubmissionUploadReviewScope, SubmissionUploadReviewStatus } from '../models/submission-upload-review';
import { SubmissionUploadSecurityMetadata } from '../models/submission-upload-security';
import { SubmissionFeatureSecurityRepository } from '../repositories/submission-feature-security-repository';
import { SubmissionUploadSecurityRepository } from '../repositories/submission-upload-security-repository';
import { optimizeExpression } from '../utils/expression-optimization';
import { getLogger } from '../utils/logger';
import { DBService } from './db-service';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { ExpressionTreeService } from './expression-tree-service';
import { SecurityRuleService } from './security-rule-service';
import { SubmissionUploadReviewService } from './upload/submission-upload-review-service';

const defaultLog = getLogger('services/submission-upload-security-service');

/**
 * Orchestrates automatic security screening for a `submission_upload`.
 *
 * Screening is an independent background workflow queued when an upload is indexed, before any approval. It does
 * NOT change `submission_upload.status`; its lifecycle is recorded as an event row in `submission_upload_security`.
 * Each run creates a security review and a linked event, assigns every screenable rule to the upload features its
 * expression matches, and completes both records in the caller's transaction.
 *
 * @export
 * @class SubmissionUploadSecurityService
 * @extends {DBService}
 */
export class SubmissionUploadSecurityService extends DBService {
  submissionUploadSecurityRepository: SubmissionUploadSecurityRepository;
  submissionFeatureSecurityRepository: SubmissionFeatureSecurityRepository;
  submissionUploadReviewService: SubmissionUploadReviewService;
  securityRuleService: SecurityRuleService;
  expressionTreeService: ExpressionTreeService;
  expressionTreeNormalizationService: ExpressionTreeNormalizationService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionUploadSecurityRepository = new SubmissionUploadSecurityRepository(connection);
    this.submissionFeatureSecurityRepository = new SubmissionFeatureSecurityRepository(connection);
    this.submissionUploadReviewService = new SubmissionUploadReviewService(connection);
    this.securityRuleService = new SecurityRuleService(connection);
    this.expressionTreeService = new ExpressionTreeService(connection);
    this.expressionTreeNormalizationService = new ExpressionTreeNormalizationService(connection);
  }

  /**
   * Run automatic security screening for a single `submission_upload`.
   *
   * Creates a security review and linked screening event, then evaluates each screenable rule's active expressions
   * against the upload's current features and assigns the rule to every match, with the event as provenance. A rule
   * without an active expression is skipped and matches nothing. Evaluation follows upload-local relationships, so
   * it needs neither approval nor published closure, and applies no user or team access filtering. Re-screening an
   * upload leaves current assignments, and their provenance, unchanged. The review and event are completed with a
   * summary of the run, all in the caller's transaction.
   *
   * @param {string} submissionUploadId UUID of the upload to screen.
   * @param {number} submissionId Submission ID that owns the upload.
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

    const review = await this.submissionUploadReviewService.insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Automatic security screening',
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.PENDING,
      requested_by: this.connection.systemUserId()
    });
    const event = await this.submissionUploadSecurityRepository.insertSubmissionUploadSecurity(
      submissionUploadId,
      jobId,
      review.submission_upload_review_id
    );

    const rules = await this.securityRuleService.getScreenableSecurityRules();
    const ruleExpressions: NormalizedSecurityRuleExpression[] = [];
    for (const rule of rules) {
      if (rule.expression_ids.length) {
        ruleExpressions.push({
          securityRuleId: rule.security_rule_id,
          expression: await this.readSecurityRuleExpression(rule.expression_ids)
        });
      }
    }

    const result = await this.submissionFeatureSecurityRepository.insertScreenedSubmissionFeatureSecurity({
      submissionId,
      submissionUploadId,
      rules: ruleExpressions,
      submissionUploadSecurityId: event.submission_upload_security_id
    });
    const metadata: SubmissionUploadSecurityMetadata = {
      evaluatedRuleCount: ruleExpressions.length,
      skippedRuleCount: rules.length - ruleExpressions.length,
      matchedFeatureCount: result.matched_feature_count,
      insertedAssignmentCount: result.inserted_count
    };

    await this.submissionUploadReviewService.updateSubmissionUploadReview(
      submissionId,
      submissionUploadId,
      review.submission_upload_review_id,
      { status: SubmissionUploadReviewStatus.COMPLETED }
    );
    await this.submissionUploadSecurityRepository.updateSubmissionUploadSecurityStatus(
      event.submission_upload_security_id,
      'completed',
      metadata
    );

    defaultLog.info({
      label: 'screenSubmissionUpload',
      message: 'Automatic security screening complete',
      submissionUploadId,
      submissionId,
      ...metadata
    });
  }

  /**
   * Read a rule's active expressions as one validated and optimized expression tree.
   *
   * A rule with several active expressions applies to a feature that matches any of them, so they are combined
   * under `OR`. Normalization resolves property metadata from the database, as search and downloads do.
   *
   * @param {string[]} expressionIds Root ids of the rule's active expressions; at least one.
   * @returns {Promise<NormalizedExpressionTree>} Expression tree ready for SQL generation.
   * @memberof SubmissionUploadSecurityService
   */
  private async readSecurityRuleExpression(expressionIds: string[]): Promise<NormalizedExpressionTree> {
    const trees: ExpressionTree[] = [];
    for (const expressionId of expressionIds) {
      trees.push(await this.expressionTreeService.readExpressionTree(expressionId));
    }

    const expression: ExpressionTree =
      trees.length === 1 ? trees[0] : { type: 'expression', operator: 'OR', clauses: trees };

    return optimizeExpression(await this.expressionTreeNormalizationService.normalize(expression));
  }

  /**
   * Record a permanently-failed screening attempt as a `failed` scan event row.
   *
   * Called by the dead-letter handler after pg-boss has exhausted retries. Because each screening
   * attempt runs in a single transaction that rolls back on error, no partial `started` row
   * survives a failure — so this creates a blocked review and a fresh event, then marks the event `failed` for
   * operator visibility.
   *
   * @param {string} submissionUploadId UUID of the upload whose screening failed.
   * @param {number} submissionId Submission ID that owns the upload.
   * @param {(string | null)} jobId The pg-boss job id, if available.
   * @returns {Promise<void>}
   * @memberof SubmissionUploadSecurityService
   */
  async recordSubmissionUploadSecurityFailure(
    submissionUploadId: string,
    submissionId: number,
    jobId: string | null
  ): Promise<void> {
    const review = await this.submissionUploadReviewService.insertSubmissionUploadReview(submissionId, {
      submission_upload_id: submissionUploadId,
      name: 'Automatic security screening',
      description: null,
      scope: SubmissionUploadReviewScope.SECURITY,
      status: SubmissionUploadReviewStatus.BLOCKED,
      requested_by: this.connection.systemUserId()
    });
    const event = await this.submissionUploadSecurityRepository.insertSubmissionUploadSecurity(
      submissionUploadId,
      jobId,
      review.submission_upload_review_id
    );

    await this.submissionUploadSecurityRepository.updateSubmissionUploadSecurityStatus(
      event.submission_upload_security_id,
      'failed'
    );
  }
}

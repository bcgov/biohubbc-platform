import { IDBConnection } from '../../database/db';
import { ApiValidationError } from '../../errors/api-error';
import { ExpressionTree } from '../../models/expression-tree';
import {
  SubmissionFeatureSecurityRulesFilters,
  SubmissionFeatureSecurityRulesResponse,
  SubmissionFeatureSecuritySelectedRulesResponse
} from '../../models/submission-feature-security';
import { SubmissionUploadReview, SubmissionUploadReviewScope } from '../../models/submission-upload-review';
import { makePaginationResponse } from '../../utils/pagination';
import { ApiPaginationOptions } from '../../zod-schema/pagination';
import { DBService } from '../db-service';
import { SecurityRuleService } from '../security-rule-service';
import { SubmissionFeatureSecurityService } from '../submission-feature-security-service';
import { SubmissionUploadReviewService } from './submission-upload-review-service';

/** Coordinates review validation and current feature-security operations through domain services. */
export class SubmissionUploadReviewSecurityService extends DBService {
  submissionUploadReviewService: SubmissionUploadReviewService;
  securityRuleService: SecurityRuleService;
  submissionFeatureSecurityService: SubmissionFeatureSecurityService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.securityRuleService = new SecurityRuleService(connection);
    this.submissionUploadReviewService = new SubmissionUploadReviewService(connection);
    this.submissionFeatureSecurityService = new SubmissionFeatureSecurityService(connection);
  }

  /**
   * List rule states for an upload selection.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Upload identifier.
   * @param {string} submissionUploadReviewId Review identifier.
   * @param {SubmissionFeatureSecurityRulesFilters} filters Feature IDs or expression scope, plus optional rule-name matching.
   * @param {ApiPaginationOptions} pagination Requested page.
   * @returns {Promise<SubmissionFeatureSecuritySelectedRulesResponse>} Rule application state and pagination.
   * @throws {ApiNotFoundError} When the review does not belong to the submission/upload.
   * @throws {ApiValidationError} When the review is not security-scoped.
   */
  async getSubmissionUploadReviewSecurityAssignments(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    filters: SubmissionFeatureSecurityRulesFilters,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureSecuritySelectedRulesResponse> {
    await this.getSubmissionUploadSecurityReview(submissionId, submissionUploadId, submissionUploadReviewId);
    const result = await this.submissionFeatureSecurityService.getSubmissionFeatureSecuritySelectedRules(
      submissionId,
      submissionUploadId,
      filters,
      pagination
    );
    return { rules: result.rules, pagination: makePaginationResponse(result.total, pagination) };
  }

  /**
   * List direct and inherited rules for one upload feature.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Upload identifier.
   * @param {string} submissionUploadReviewId Review identifier.
   * @param {number} submissionFeatureId Feature identifier.
   * @param {ApiPaginationOptions} pagination Requested page.
   * @returns {Promise<SubmissionFeatureSecurityRulesResponse>} Feature rules and pagination.
   * @throws {ApiNotFoundError} When the review does not belong to the submission/upload.
   * @throws {ApiValidationError} When the review is not security-scoped.
   */
  async getSubmissionUploadReviewFeatureSecurityRules(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureId: number,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureSecurityRulesResponse> {
    await this.getSubmissionUploadSecurityReview(submissionId, submissionUploadId, submissionUploadReviewId);
    const result = await this.submissionFeatureSecurityService.getSubmissionFeatureSecurityRules(
      submissionUploadId,
      [submissionFeatureId],
      {},
      pagination
    );
    return { rules: result.rules, pagination: makePaginationResponse(result.total, pagination) };
  }

  /**
   * Ensure direct rule assignments exist without changing current assignment provenance.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Upload boundary.
   * @param {string} submissionUploadReviewId Security review identifier.
   * @param {number} securityRuleId Rule identifier.
   * @param {number[]} submissionFeatureIds Selected IDs; otherwise expression matches or all upload features.
   * @param {ExpressionTree} [expression] Applied expression used only without an explicit selection.
   * @returns {Promise<void>} Resolves after the desired assignment state is established.
   */
  async insertSubmissionUploadReviewSecurityRuleAssignments(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    securityRuleId: number,
    submissionFeatureIds: number[],
    expression?: ExpressionTree
  ): Promise<void> {
    await this.getSubmissionUploadSecurityReview(submissionId, submissionUploadId, submissionUploadReviewId);
    await this.securityRuleService.assertSecurityRulesValid([securityRuleId]);
    await this.submissionFeatureSecurityService.insertSubmissionFeatureSecurity({
      submissionId,
      submissionUploadId,
      securityRuleIds: [securityRuleId],
      submissionUploadReviewId,
      featureScope: { submissionFeatureIds, expression }
    });
  }

  /**
   * Ensure direct rule assignments are absent; missing assignments are not an error.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Upload boundary.
   * @param {string} submissionUploadReviewId Security review identifier.
   * @param {number} securityRuleId Rule identifier.
   * @param {number[]} submissionFeatureIds Selected IDs; otherwise expression matches or all upload features.
   * @param {ExpressionTree} [expression] Applied expression used only without an explicit selection.
   * @returns {Promise<void>} Resolves after the desired assignment state is established.
   */
  async deleteSubmissionUploadReviewSecurityRuleAssignments(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    securityRuleId: number,
    submissionFeatureIds: number[],
    expression?: ExpressionTree
  ): Promise<void> {
    await this.getSubmissionUploadSecurityReview(submissionId, submissionUploadId, submissionUploadReviewId);
    await this.submissionFeatureSecurityService.deleteSubmissionFeatureSecurityRules({
      submissionId,
      submissionUploadId,
      securityRuleIds: [securityRuleId],
      featureScope: { submissionFeatureIds, expression }
    });
  }

  /**
   * Reset direct security for selected features, otherwise expression matches, otherwise the entire reviewed upload.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Upload identifier.
   * @param {string} submissionUploadReviewId Review identifier.
   * @param {number[]} submissionFeatureIds Selected IDs; otherwise expression matches or all upload features.
   * @param {ExpressionTree} [expression] Applied expression used only without an explicit selection.
   * @returns {Promise<void>} Resolves after reset.
   * @throws {ApiNotFoundError} When the review does not belong to the submission/upload.
   * @throws {ApiValidationError} When the review is not security-scoped.
   */
  async deleteSubmissionUploadReviewSecurityAssignments(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string,
    submissionFeatureIds: number[] = [],
    expression?: ExpressionTree
  ): Promise<void> {
    await this.getSubmissionUploadSecurityReview(submissionId, submissionUploadId, submissionUploadReviewId);
    await this.submissionFeatureSecurityService.deleteSubmissionFeatureSecurity({
      submissionId,
      submissionUploadId,
      featureScope: { submissionFeatureIds, expression }
    });
  }

  /**
   * Get the owned review and verify that it has security scope.
   *
   * @param {number} submissionId Submission identifier.
   * @param {string} submissionUploadId Upload identifier.
   * @param {string} submissionUploadReviewId Review identifier.
   * @returns {Promise<SubmissionUploadReview>} The owned security review.
   * @throws {ApiValidationError} When review scope is not security.
   * @throws {ApiNotFoundError} When the review does not belong to the submission/upload.
   */
  private async getSubmissionUploadSecurityReview(
    submissionId: number,
    submissionUploadId: string,
    submissionUploadReviewId: string
  ): Promise<SubmissionUploadReview> {
    const review = await this.submissionUploadReviewService.getSubmissionUploadReview(
      submissionId,
      submissionUploadId,
      submissionUploadReviewId
    );
    if (review.scope !== SubmissionUploadReviewScope.SECURITY) {
      throw new ApiValidationError('Review must have security scope');
    }
    return review;
  }
}

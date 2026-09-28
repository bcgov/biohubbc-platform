import { IDBConnection } from '../database/db';
import {
  DeleteSubmissionFeatureSecurity,
  DeleteSubmissionFeatureSecurityRules,
  InsertSubmissionFeatureSecurity,
  NormalizedSubmissionFeatureSecurityFeatureScope,
  NormalizedSubmissionFeatureSecurityRulesFilters,
  SubmissionFeatureSecurityFeatureScope,
  SubmissionFeatureSecurityRulesFilters,
  SubmissionFeatureSecurityRulesResult,
  SubmissionFeatureSecuritySelectedRulesResult
} from '../models/submission-feature-security';
import { SubmissionFeatureSecurityRepository } from '../repositories/submission-feature-security-repository';
import { optimizeExpression } from '../utils/expression-optimization';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';

/** Validates and normalizes feature-security operations before delegating persistence. */
export class SubmissionFeatureSecurityService extends DBService {
  submissionFeatureSecurityRepository: SubmissionFeatureSecurityRepository;
  expressionTreeNormalizationService: ExpressionTreeNormalizationService;

  constructor(connection: IDBConnection) {
    super(connection);
    this.submissionFeatureSecurityRepository = new SubmissionFeatureSecurityRepository(connection);
    this.expressionTreeNormalizationService = new ExpressionTreeNormalizationService(connection);
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

  /**
   * Read aggregate direct-assignment state within one upload.
   *
   * @param {number} submissionId Submission boundary.
   * @param {string} submissionUploadId Upload boundary.
   * @param {SubmissionFeatureSecurityRulesFilters} filters Feature IDs or expression scope, plus optional rule-name matching.
   * @param {ApiPaginationOptions} pagination Requested page.
   * @returns {Promise<SubmissionFeatureSecuritySelectedRulesResult>} Rules and their application state.
   */
  async getSubmissionFeatureSecuritySelectedRules(
    submissionId: number,
    submissionUploadId: string,
    filters: SubmissionFeatureSecurityRulesFilters,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureSecuritySelectedRulesResult> {
    const featureScope = await this.normalizeSubmissionFeatureSecurityFeatureScope({
      submissionFeatureIds: filters.submissionFeatureIds,
      expression: filters.expression
    });
    const normalizedFilters: NormalizedSubmissionFeatureSecurityRulesFilters = {
      ...featureScope,
      keyword: filters.keyword
    };

    return this.submissionFeatureSecurityRepository.getSubmissionFeatureSecuritySelectedRules(
      submissionId,
      submissionUploadId,
      normalizedFilters,
      pagination
    );
  }

  /**
   * Get direct and inherited rules affecting upload features.
   *
   * @param {string} submissionUploadId Upload boundary.
   * @param {number[]} submissionFeatureIds Explicit feature selection; empty selects nothing.
   * @param {SubmissionFeatureSecurityRulesFilters} filters Optional rule-name matching.
   * @param {ApiPaginationOptions} pagination Requested page.
   * @returns {Promise<SubmissionFeatureSecurityRulesResult>} Rule page and count.
   */
  async getSubmissionFeatureSecurityRules(
    submissionUploadId: string,
    submissionFeatureIds: number[],
    filters: SubmissionFeatureSecurityRulesFilters,
    pagination: ApiPaginationOptions
  ): Promise<SubmissionFeatureSecurityRulesResult> {
    return this.submissionFeatureSecurityRepository.getSubmissionFeatureSecurityRules(
      submissionUploadId,
      submissionFeatureIds,
      filters,
      pagination
    );
  }

  /**
   * Assign prevalidated rules to current upload features with review provenance.
   *
   * @param {InsertSubmissionFeatureSecurity} input Upload boundary, feature selection, and mutation inputs.
   * @returns {Promise<void>} Resolves after persisting the mutation.
   */
  async insertSubmissionFeatureSecurity(input: InsertSubmissionFeatureSecurity): Promise<void> {
    const featureScope = await this.normalizeSubmissionFeatureSecurityFeatureScope(input.featureScope);
    const normalizedInput = { ...input, featureScope };

    await this.submissionFeatureSecurityRepository.insertSubmissionFeatureSecurity(normalizedInput);
  }

  /**
   * Remove requested rules from current upload features; empty rule IDs remove nothing.
   *
   * @param {DeleteSubmissionFeatureSecurityRules} input Upload boundary, feature selection, and mutation inputs.
   * @returns {Promise<void>} Resolves after persisting the mutation.
   */
  async deleteSubmissionFeatureSecurityRules(input: DeleteSubmissionFeatureSecurityRules): Promise<void> {
    const featureScope = await this.normalizeSubmissionFeatureSecurityFeatureScope(input.featureScope);
    const normalizedInput = { ...input, featureScope };

    await this.submissionFeatureSecurityRepository.deleteSubmissionFeatureSecurityRules(normalizedInput);
  }

  /**
   * Clear all direct assignments from current upload features.
   *
   * @param {DeleteSubmissionFeatureSecurity} input Upload boundary, feature selection, and mutation inputs.
   * @returns {Promise<void>} Resolves after persisting the mutation.
   */
  async deleteSubmissionFeatureSecurity(input: DeleteSubmissionFeatureSecurity): Promise<void> {
    const featureScope = await this.normalizeSubmissionFeatureSecurityFeatureScope(input.featureScope);
    const normalizedInput = { ...input, featureScope };

    await this.submissionFeatureSecurityRepository.deleteSubmissionFeatureSecurity(normalizedInput);
  }

  /**
   * Resolve explicit-ID precedence and normalize only an expression that will be used.
   * Empty ID arrays fall through to expression matches or whole-upload scope.
   *
   * @param {SubmissionFeatureSecurityFeatureScope} featureScope Raw review feature selection.
   * @returns {Promise<NormalizedSubmissionFeatureSecurityFeatureScope>} Database-ready selection criteria.
   */
  private async normalizeSubmissionFeatureSecurityFeatureScope(
    featureScope: SubmissionFeatureSecurityFeatureScope
  ): Promise<NormalizedSubmissionFeatureSecurityFeatureScope> {
    if (featureScope.submissionFeatureIds?.length) {
      return { submissionFeatureIds: featureScope.submissionFeatureIds };
    }

    if (featureScope.expression) {
      const normalizedExpression = await this.expressionTreeNormalizationService.normalize(featureScope.expression);
      const optimizedExpression = optimizeExpression(normalizedExpression);

      return { expression: optimizedExpression };
    }

    return {};
  }
}

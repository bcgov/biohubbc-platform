import { ANONYMOUS_SEARCH_FEATURE_SECURITY_CONTEXT } from '../constants/security';
import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
import {
  SearchFeatureFilters,
  SearchFeaturePage,
  SearchFeatureSecurityContext,
  SubmissionUploadFeatureSearchFilters
} from '../models/search';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { optimizeExpression } from '../utils/expression-optimization';
import { getLogger } from '../utils/logger';
import { encodeSearchFeatureCursor, ensureCompleteCursorPaginationOptions } from '../utils/pagination';
import { ApiCursorPaginationOptions, ApiCursorPaginationResults } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { ExpressionTreeNormalizationService } from './expression-tree-normalization-service';
import { SearchFeatureResultWithRelevancy } from './search-feature-service.interface';

const defaultLog = getLogger('services/search-feature-service');

/**
 * Service for searching features with multiple filter types.
 * Delegates to SearchFeatureRepository for all database operations.
 */
export class SearchFeatureService extends DBService {
  searchFeatureRepository: SearchFeatureRepository;
  expressionTreeNormalizationService: ExpressionTreeNormalizationService;

  /**
   * Initializes the SearchFeatureService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.searchFeatureRepository = new SearchFeatureRepository(connection);
    this.expressionTreeNormalizationService = new ExpressionTreeNormalizationService(connection);
  }

  /**
   * Search features that match an expression tree.
   *
   * @param {string | null} anchorFeatureType - Result feature type, or null to match all feature types
   * @param {ExpressionTree | null} expressionTree - Matching criteria, or null for all features in scope.
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination settings
   * @param {SearchFeatureSecurityContext} [securityContext] - Caller identity and access mode; defaults to anonymous
   * @param {SearchFeatureFilters} [filters] Submission/upload scope.
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Matching, accessible feature rows
   */
  async searchFeaturesByExpressionTree(
    anchorFeatureType: string | null,
    expressionTree: ExpressionTree | null,
    cursorPagination?: ApiCursorPaginationOptions,
    securityContext: SearchFeatureSecurityContext = ANONYMOUS_SEARCH_FEATURE_SECURITY_CONTEXT,
    filters?: SearchFeatureFilters
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({
      label: 'searchFeaturesByExpressionTree',
      anchorFeatureType,
      expressionTree,
      cursorPagination
    });
    const expression = await this.prepareSearchExpression(anchorFeatureType, expressionTree);
    return this.searchFeatureRepository.searchFeaturesByExpressionTree(
      anchorFeatureType,
      expression,
      cursorPagination,
      securityContext,
      filters
    );
  }

  /**
   * Search features and load result property metadata for a feature-type anchored expression search.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {ExpressionTree | null} expressionTree - Matching criteria, or null for all features in scope.
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination settings
   * @param {SearchFeatureSecurityContext} [securityContext] - Caller identity and access mode; defaults to anonymous
   * @param {SearchFeatureFilters} [filters] Submission/upload scope.
   * @return {Promise<{ features: SearchFeatureResultWithRelevancy[]; properties: FeatureTypeProperty[]; has_inaccessible_secured_features: boolean; pagination: ApiCursorPaginationResults }>} Feature rows, metadata, security indicator, and adjacent-page cursors
   */
  async searchFeaturesByExpressionTreeWithMetadata(
    anchorFeatureType: string,
    expressionTree: ExpressionTree | null,
    cursorPagination?: ApiCursorPaginationOptions,
    securityContext: SearchFeatureSecurityContext = ANONYMOUS_SEARCH_FEATURE_SECURITY_CONTEXT,
    filters?: SearchFeatureFilters
  ): Promise<{
    features: SearchFeatureResultWithRelevancy[];
    properties: FeatureTypeProperty[];
    has_inaccessible_secured_features: boolean;
    pagination: ApiCursorPaginationResults;
  }> {
    const expression = await this.prepareSearchExpression(anchorFeatureType, expressionTree);
    const [page, properties, hasInaccessibleSecuredFeatures] = await Promise.all([
      this.getPublishedSearchFeaturePage(anchorFeatureType, expression, cursorPagination, securityContext, filters),
      this.searchFeatureRepository.getFeatureTypeProperties(anchorFeatureType),
      this.searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
        anchorFeatureType,
        expression,
        securityContext,
        filters
      )
    ]);
    return { ...page, properties, has_inaccessible_secured_features: hasInaccessibleSecuredFeatures };
  }

  /**
   * Search every feature type within an upload for an authorized administrator.
   * @param {number} submissionId Submission boundary.
   * @param {string} submissionUploadId Upload boundary.
   * @param {SubmissionUploadFeatureSearchFilters} filters Matching criteria; omitted or null expression matches all upload features.
   * @param {ApiCursorPaginationOptions} [cursorPagination] Requested cursor page.
   * @returns {Promise<SearchFeaturePage>} Matching upload features, including secured features, without property metadata.
   */
  async searchSubmissionUploadFeatures(
    submissionId: number,
    submissionUploadId: string,
    filters: SubmissionUploadFeatureSearchFilters,
    cursorPagination?: ApiCursorPaginationOptions
  ): Promise<SearchFeaturePage> {
    const expression = await this.prepareSearchExpression(null, filters.expression ?? null);
    const pagination = ensureCompleteCursorPaginationOptions(cursorPagination);
    const rows = await this.searchFeatureRepository.searchSubmissionUploadFeatures(
      submissionId,
      submissionUploadId,
      { expression },
      { ...pagination, limit: pagination.limit + 1 }
    );
    const isPrevious = pagination.boundary?.direction === 'previous';
    const hasLookahead = rows.length > pagination.limit;
    const features = isPrevious ? rows.slice(-pagination.limit) : rows.slice(0, pagination.limit);
    return {
      features,
      pagination: this.buildSearchFeatureCursorPagination(
        features,
        pagination,
        isPrevious || hasLookahead,
        pagination.boundary?.direction === 'next' || (isPrevious && hasLookahead)
      )
    };
  }

  /**
   * Count mixed-type upload matches for an authorized administrator using the same scope as upload search.
   * @param {number} submissionId Submission boundary.
   * @param {string} submissionUploadId Upload boundary.
   * @param {SubmissionUploadFeatureSearchFilters} filters Matching criteria; omitted or null expression matches all upload features.
   * @returns {Promise<number>} Matching feature count, including secured features.
   */
  async countSubmissionUploadFeatures(
    submissionId: number,
    submissionUploadId: string,
    filters: SubmissionUploadFeatureSearchFilters
  ): Promise<number> {
    const expression = await this.prepareSearchExpression(null, filters.expression ?? null);
    return this.searchFeatureRepository.countSubmissionUploadFeatures(submissionId, submissionUploadId, { expression });
  }

  /**
   * Fetch a published-search cursor page with lookahead and boundary handling.
   * @param {string} anchorFeatureType Published result feature type.
   * @param {NormalizedExpressionTree | null} expression Normalized criteria, or null for all features in scope.
   * @param {ApiCursorPaginationOptions} [cursorPagination] Requested cursor page.
   * @param {SearchFeatureSecurityContext} [securityContext] Search authorization context.
   * @param {SearchFeatureFilters} [filters] Submission/upload boundaries.
   * @returns {Promise<SearchFeaturePage>} Feature page with adjacent-page cursors.
   */
  private async getPublishedSearchFeaturePage(
    anchorFeatureType: string,
    expression: NormalizedExpressionTree | null,
    cursorPagination?: ApiCursorPaginationOptions,
    securityContext: SearchFeatureSecurityContext = ANONYMOUS_SEARCH_FEATURE_SECURITY_CONTEXT,
    filters?: SearchFeatureFilters
  ): Promise<SearchFeaturePage> {
    const pagination = ensureCompleteCursorPaginationOptions(cursorPagination);
    const rows = await this.searchFeatureRepository.searchFeaturesByExpressionTree(
      anchorFeatureType,
      expression,
      { ...pagination, limit: pagination.limit + 1 },
      securityContext,
      filters
    );
    const direction = pagination.boundary?.direction;
    const isPrevious = direction === 'previous';
    const hasLookahead = rows.length > pagination.limit;
    // The repository restores display order, so backward lookahead is the first row.
    const features = isPrevious ? rows.slice(-pagination.limit) : rows.slice(0, pagination.limit);
    const hasNext = isPrevious || hasLookahead;
    const hasPrevious = direction === 'next' || (isPrevious && hasLookahead);

    return {
      features,
      pagination: this.buildSearchFeatureCursorPagination(features, pagination, hasNext, hasPrevious)
    };
  }

  /**
   * Builds cursor-pagination metadata from the request and page boundary rows.
   *
   * Every cursor contains the boundary feature's ID and creation date. ID sorting
   * uses the ID directly; date sorting uses the date plus the ID as a stable
   * tie-breaker. The first row anchors the previous cursor and the last row
   * anchors the next cursor. Lookahead proves availability in the requested
   * direction; the incoming cursor identifies the return direction.
   * Return navigation may become stale if matching rows change between requests.
   *
   * @param {SearchFeatureResultWithRelevancy[]} features - Ordered feature rows for the current page
   * @param {ApiCursorPaginationOptions} cursorPagination - Cursor-pagination request used to produce the page
   * @param {boolean} hasNext - Whether accessible matches exist after the returned rows.
   * @param {boolean} hasPrevious - Whether accessible matches exist before the returned rows.
   * @return {ApiCursorPaginationResults} Effective limit/sort/order and encoded cursors for adjacent pages
   */
  private buildSearchFeatureCursorPagination(
    features: SearchFeatureResultWithRelevancy[],
    cursorPagination: ApiCursorPaginationOptions,
    hasNext: boolean,
    hasPrevious: boolean
  ): ApiCursorPaginationResults {
    const { limit, sort, order } = cursorPagination;
    const metadata = { limit, sort, order };

    if (features.length === 0) {
      return { ...metadata, next_cursor: null, previous_cursor: null };
    }

    const firstFeature = features.at(0)!;
    const lastFeature = features.at(-1)!;

    const encode = (feature: SearchFeatureResultWithRelevancy, direction: 'next' | 'previous') =>
      encodeSearchFeatureCursor({
        direction,
        submission_feature_id: feature.submission_feature_id,
        create_date: feature.create_date
      });

    return {
      ...metadata,
      next_cursor: hasNext ? encode(lastFeature, 'next') : null,
      previous_cursor: hasPrevious ? encode(firstFeature, 'previous') : null
    };
  }

  /**
   * Counts the number of features matching an expression tree.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search.
   * @param {ExpressionTree | null} expressionTree - Matching criteria, or null for all features in scope.
   * @param {SearchFeatureSecurityContext} [securityContext] - Caller identity and access mode; defaults to anonymous.
   * @param {SearchFeatureFilters} [filters] Submission/upload scope.
   * @return {Promise<number>} Matching feature count.
   */
  async countSearchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree: ExpressionTree | null,
    securityContext: SearchFeatureSecurityContext = ANONYMOUS_SEARCH_FEATURE_SECURITY_CONTEXT,
    filters?: SearchFeatureFilters
  ): Promise<number> {
    defaultLog.debug({ label: 'countSearchFeaturesByExpressionTree', anchorFeatureType, expressionTree });
    const expression = await this.prepareSearchExpression(anchorFeatureType, expressionTree);

    return this.searchFeatureRepository.countFeaturesByExpressionTree(
      anchorFeatureType,
      expression,
      securityContext,
      filters
    );
  }

  /**
   * Validates and normalizes the shared inputs for an expression-tree search.
   *
   * @example
   * `Count > 7 AND Count < 9 AND Count > 7` first resolves Count as a numeric property, then returns the optimized
   * `AND(Count > 7, Count < 9)` representation consumed by both result and count repositories. A null expression
   * returns null after feature-type validation.
   *
   * @param {string | null} anchorFeatureType - Target feature type to validate
   * @param {ExpressionTree | null} expressionTree - Matching criteria, or null for all features in scope.
   * @return {Promise<NormalizedExpressionTree | null>} Validated and optimized expression tree, or null.
   */
  private async prepareSearchExpression(
    anchorFeatureType: string | null,
    expressionTree: ExpressionTree | null
  ): Promise<NormalizedExpressionTree | null> {
    const submissionRepository = new SubmissionRepository(this.connection);
    if (anchorFeatureType !== null) {
      await submissionRepository.getFeatureTypeIdByName(anchorFeatureType);
    }

    if (!expressionTree) {
      return null;
    }

    const normalizedExpression = await this.expressionTreeNormalizationService.normalize(expressionTree);
    return optimizeExpression(normalizedExpression);
  }
}

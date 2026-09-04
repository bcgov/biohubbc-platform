import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { encodeSearchFeatureCursor, ensureCompleteCursorPaginationOptions } from '../utils/pagination';
import { ApiCursorPaginationOptions, ApiCursorPaginationResults } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';
import { SearchFeatureResultWithRelevancy } from './search-feature-service.interface';

const defaultLog = getLogger('services/search-feature-service');

/**
 * Service for searching features with multiple filter types.
 * Delegates to SearchFeatureRepository for all database operations.
 */
export class SearchFeatureService extends DBService {
  searchFeatureRepository: SearchFeatureRepository;
  semanticValidator: ExpressionPredicateSemanticValidator;

  /**
   * Initializes the SearchFeatureService with a database connection.
   *
   * @param {IDBConnection} connection - Database connection instance
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.searchFeatureRepository = new SearchFeatureRepository(connection);
    this.semanticValidator = new ExpressionPredicateSemanticValidator(connection);
  }

  /**
   * Search features that match an expression tree.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination settings
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Matching, accessible feature rows
   */
  async searchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree?: ExpressionTree,
    cursorPagination?: ApiCursorPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({
      label: 'searchFeaturesByExpressionTree',
      anchorFeatureType,
      expressionTree,
      cursorPagination
    });
    const normalizedExpressionTree = await this.prepareExpressionTreeSearch(anchorFeatureType, expressionTree);
    return this.searchFeatureRepository.searchFeaturesByExpressionTree(
      anchorFeatureType,
      normalizedExpressionTree,
      cursorPagination,
      systemUserId
    );
  }

  /**
   * Search features and load result property metadata for a feature-type anchored expression search.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination settings
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<{ features: SearchFeatureResultWithRelevancy[]; properties: FeatureTypeProperty[]; has_more_secured_features: boolean; pagination: ApiCursorPaginationResults }>} Feature rows, metadata, security indicator, and adjacent-page cursors
   */
  async searchFeaturesByExpressionTreeWithMetadata(
    anchorFeatureType: string,
    expressionTree?: ExpressionTree,
    cursorPagination?: ApiCursorPaginationOptions,
    systemUserId?: number | null
  ): Promise<{
    features: SearchFeatureResultWithRelevancy[];
    properties: FeatureTypeProperty[];
    has_more_secured_features: boolean;
    pagination: ApiCursorPaginationResults;
  }> {
    defaultLog.debug({
      label: 'searchFeaturesByExpressionTreeWithMetadata',
      anchorFeatureType,
      expressionTree,
      cursorPagination
    });

    const normalizedExpressionTree = await this.prepareExpressionTreeSearch(anchorFeatureType, expressionTree);

    const [features, properties, has_more_secured_features] = await Promise.all([
      this.searchFeatureRepository.searchFeaturesByExpressionTree(
        anchorFeatureType,
        normalizedExpressionTree,
        cursorPagination,
        systemUserId
      ),
      this.searchFeatureRepository.getFeatureTypeProperties(anchorFeatureType),
      this.searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
        anchorFeatureType,
        normalizedExpressionTree,
        systemUserId
      )
    ]);

    return {
      features,
      properties,
      has_more_secured_features,
      pagination: this.buildSearchFeatureCursorPagination(features, cursorPagination)
    };
  }

  /**
   * Builds cursor-pagination metadata from the request and page boundary rows.
   *
   * Every cursor contains the boundary feature's ID and creation date. ID sorting
   * uses the ID directly; date sorting uses the date plus the ID as a stable
   * tie-breaker. The first row anchors the previous cursor and the last row
   * anchors the next cursor.
   *
   * @param {SearchFeatureResultWithRelevancy[]} features - Ordered feature rows for the current page
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Cursor-pagination request used to produce the page
   * @return {ApiCursorPaginationResults} Effective limit/sort/order and encoded cursors for adjacent pages
   */
  private buildSearchFeatureCursorPagination(
    features: SearchFeatureResultWithRelevancy[],
    cursorPagination?: ApiCursorPaginationOptions
  ): ApiCursorPaginationResults {
    const { limit, sort, order, boundary } = ensureCompleteCursorPaginationOptions(cursorPagination);
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
      next_cursor: features.length === limit ? encode(lastFeature, 'next') : null,
      previous_cursor: boundary ? encode(firstFeature, 'previous') : null
    };
  }

  /**
   * Counts the number of features matching an expression tree.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search.
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria.
   * @param {number | null} [systemUserId] - Security context.
   * @return {Promise<number>} Matching feature count.
   */
  async countSearchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree?: ExpressionTree,
    systemUserId?: number | null
  ): Promise<number> {
    defaultLog.debug({ label: 'countSearchFeaturesByExpressionTree', anchorFeatureType, expressionTree });
    const normalizedExpressionTree = await this.prepareExpressionTreeSearch(anchorFeatureType, expressionTree);

    return this.searchFeatureRepository.countFeaturesByExpressionTree(
      anchorFeatureType,
      normalizedExpressionTree,
      systemUserId
    );
  }

  /**
   * Validates and normalizes the shared inputs for an expression-tree search.
   *
   * @param {string} anchorFeatureType - Target feature type to validate
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @return {Promise<NormalizedExpressionTreeExpression | undefined>} Normalized expression tree, when supplied
   */
  private async prepareExpressionTreeSearch(
    anchorFeatureType: string,
    expressionTree?: ExpressionTree
  ): Promise<NormalizedExpressionTreeExpression | undefined> {
    const submissionRepository = new SubmissionRepository(this.connection);
    await submissionRepository.getFeatureTypeIdByName(anchorFeatureType);

    return expressionTree ? this.semanticValidator.validateExpressionTree(expressionTree) : undefined;
  }
}

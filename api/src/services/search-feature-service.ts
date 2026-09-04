import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
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
    const expression = await this.prepareSearchExpression(anchorFeatureType, expressionTree);
    return this.searchFeatureRepository.searchFeaturesByExpressionTree(
      anchorFeatureType,
      expression,
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

    const expression = await this.prepareSearchExpression(anchorFeatureType, expressionTree);

    const [features, properties, has_more_secured_features] = await Promise.all([
      this.searchFeatureRepository.searchFeaturesByExpressionTree(
        anchorFeatureType,
        expression,
        cursorPagination,
        systemUserId
      ),
      this.searchFeatureRepository.getFeatureTypeProperties(anchorFeatureType),
      this.searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
        anchorFeatureType,
        expression,
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
   * @example
   * A full 25-row first page returns a next cursor built from row 25 and no previous cursor. A request containing a
   * boundary returns a previous cursor built from row 1. A short or empty page returns no next cursor because there is
   * no evidence that another page exists.
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
    const expression = await this.prepareSearchExpression(anchorFeatureType, expressionTree);

    return this.searchFeatureRepository.countFeaturesByExpressionTree(anchorFeatureType, expression, systemUserId);
  }

  /**
   * Validates and normalizes the shared inputs for an expression-tree search.
   *
   * @example
   * `Count > 7 AND Count < 9 AND Count > 7` first resolves Count as a numeric property, then returns the optimized
   * `AND(Count > 7, Count < 9)` representation consumed by both result and count repositories. An omitted expression
   * returns undefined after feature-type validation.
   *
   * @param {string} anchorFeatureType - Target feature type to validate
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @return {Promise<NormalizedExpressionTree | undefined>} Validated and optimized expression tree, when supplied
   */
  private async prepareSearchExpression(
    anchorFeatureType: string,
    expressionTree?: ExpressionTree
  ): Promise<NormalizedExpressionTree | undefined> {
    const submissionRepository = new SubmissionRepository(this.connection);
    await submissionRepository.getFeatureTypeIdByName(anchorFeatureType);

    if (!expressionTree) {
      return undefined;
    }

    const normalizedExpression = await this.expressionTreeNormalizationService.normalize(expressionTree);
    return optimizeExpression(normalizedExpression);
  }
}

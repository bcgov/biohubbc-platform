import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
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
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<SearchFeatureResultWithRelevancy[]>}
   */
  async searchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree: ExpressionTree | undefined,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({ label: 'searchFeaturesByExpressionTree', anchorFeatureType, expressionTree, pagination });
    await this.validateExpressionTreeTargetFeatureType(anchorFeatureType);
    const normalizedExpressionTree = expressionTree
      ? await this.semanticValidator.validateExpressionTree(expressionTree)
      : undefined;
    return this.searchFeatureRepository.searchFeaturesByExpressionTree(
      anchorFeatureType,
      normalizedExpressionTree,
      pagination,
      systemUserId
    );
  }

  /**
   * Search features and count matching rows for a feature-type anchored expression search.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<{ features: SearchFeatureResultWithRelevancy[]; properties: FeatureTypeProperty[]; count: number; has_more_secured_features: boolean }>}
   */
  async searchFeaturesByExpressionTreeWithCount(
    anchorFeatureType: string,
    expressionTree: ExpressionTree | undefined,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<{
    features: SearchFeatureResultWithRelevancy[];
    properties: FeatureTypeProperty[];
    count: number;
    has_more_secured_features: boolean;
  }> {
    defaultLog.debug({
      label: 'searchFeaturesByExpressionTreeWithCount',
      anchorFeatureType,
      expressionTree,
      pagination
    });

    await this.validateExpressionTreeTargetFeatureType(anchorFeatureType);
    const normalizedExpressionTree = expressionTree
      ? await this.semanticValidator.validateExpressionTree(expressionTree)
      : undefined;

    const [features, properties, count, has_more_secured_features] = await Promise.all([
      this.searchFeatureRepository.searchFeaturesByExpressionTree(
        anchorFeatureType,
        normalizedExpressionTree,
        pagination,
        systemUserId
      ),
      this.searchFeatureRepository.searchFeaturesByExpressionTreeProperties(
        anchorFeatureType,
        normalizedExpressionTree,
        systemUserId
      ),
      this.searchFeatureRepository.searchFeaturesByExpressionTreeCount(
        anchorFeatureType,
        normalizedExpressionTree,
        systemUserId
      ),
      this.searchFeatureRepository.hasInaccessibleSecuredFeaturesByExpressionTree(
        anchorFeatureType,
        normalizedExpressionTree,
        systemUserId
      )
    ]);

    return { features, properties, count, has_more_secured_features };
  }

  /**
   * Gets the total count of features matching an expression tree.
   *
   * @param {ExpressionTree} [expressionTree] - Optional structured expression tree criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<number>} Total count of matching features
   */
  async getSearchFeaturesCountByExpressionTree(
    anchorFeatureType: string,
    expressionTree: ExpressionTree | undefined,
    systemUserId?: number | null
  ): Promise<number> {
    defaultLog.debug({ label: 'getSearchFeaturesCountByExpressionTree', anchorFeatureType, expressionTree });
    await this.validateExpressionTreeTargetFeatureType(anchorFeatureType);
    const normalizedExpressionTree = expressionTree
      ? await this.semanticValidator.validateExpressionTree(expressionTree)
      : undefined;
    return this.searchFeatureRepository.searchFeaturesByExpressionTreeCount(
      anchorFeatureType,
      normalizedExpressionTree,
      systemUserId
    );
  }

  /**
   * Validate that an expression-tree search target exists before delegating to the repository.
   *
   * @param {string} anchorFeatureType
   * @return {Promise<void>}
   */
  private async validateExpressionTreeTargetFeatureType(anchorFeatureType: string): Promise<void> {
    const submissionRepository = new SubmissionRepository(this.connection);
    await submissionRepository.getFeatureTypeIdByName(anchorFeatureType);
  }
}

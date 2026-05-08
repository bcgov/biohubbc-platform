import { Knex } from 'knex';
import { IDBConnection } from '../database/db';
import { ExpressionTree } from '../models/expression-tree';
import { SearchFeatureRepository } from '../repositories/search-feature-repository';
import { SubmissionRepository } from '../repositories/submission-repository';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { DBService } from './db-service';
import { ExpressionPredicateSemanticValidator } from './expression-predicate-semantic-validator';
import { ISearchFeaturesFilters, SearchFeatureResultWithRelevancy } from './search-feature-service.interface';

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
   * Main search method for features.
   * Accepts multiple filter types (keywords, property filters, ITIS TSNs, property types)
   * and returns results matching all criteria with aggregated relevancy scores.
   *
   * @param {ISearchFeaturesFilters} filters - Search filter criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Array of features sorted by relevancy
   */
  async searchFeatures(
    filters: ISearchFeaturesFilters,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    defaultLog.debug({ label: 'searchFeatures', filters, pagination });
    return this.searchFeatureRepository.searchFeaturesByFilters(filters, pagination, systemUserId);
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
   * @return {Promise<{ features: SearchFeatureResultWithRelevancy[]; count: number }>}
   */
  async searchFeaturesByExpressionTreeWithCount(
    anchorFeatureType: string,
    expressionTree: ExpressionTree | undefined,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<{ features: SearchFeatureResultWithRelevancy[]; count: number }> {
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

    const [features, count] = await Promise.all([
      this.searchFeatureRepository.searchFeaturesByExpressionTree(
        anchorFeatureType,
        normalizedExpressionTree,
        pagination,
        systemUserId
      ),
      this.searchFeatureRepository.searchFeaturesByExpressionTreeCount(
        anchorFeatureType,
        normalizedExpressionTree,
        systemUserId
      )
    ]);

    return { features, count };
  }

  /**
   * Gets the total count of features matching the search criteria.
   * Accepts multiple filter types (keywords, property filters, ITIS TSNs, property types)
   * and returns the count of results matching all criteria.
   *
   * @param {ISearchFeaturesFilters} filters - Search filter criteria
   * @return {Promise<number>} Total count of matching features
   */
  async getSearchFeaturesCount(filters: ISearchFeaturesFilters, systemUserId?: number | null): Promise<number> {
    defaultLog.debug({ label: 'getSearchFeaturesCount', filters });
    return this.searchFeatureRepository.searchFeaturesByFiltersCount(filters, systemUserId);
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

  /**
   * Returns submission feature IDs matching the provided search filters.
   * Delegates to repository for the CTE-based query.
   *
   * @param {ISearchFeaturesFilters} filters - Search filters (keyword, feature_types, species, properties)
   * @returns {Promise<number[]>} Array of matching submission_feature_id values
   */
  async getSearchFeatureIds(filters: ISearchFeaturesFilters, systemUserId?: number | null): Promise<number[]> {
    defaultLog.debug({ label: 'getSearchFeatureIds', filters });
    const rows = await this.searchFeatureRepository.searchFeatureIdsByFilters(filters, systemUserId);
    return rows.map((row) => row.submission_feature_id);
  }

  /**
   * Build a Knex subquery returning matching submission_feature_ids
   * without executing it. Used by DownloadService to compose
   * the search as a SQL subquery (no JS round-trip for large sets).
   *
   * @param {ISearchFeaturesFilters} filters - Search filters
   * @param {number | null} [systemUserId] - Security context
   * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows
   */
  buildSearchFeatureIdsSubquery(filters: ISearchFeaturesFilters, systemUserId?: number | null): Knex.QueryBuilder {
    return this.searchFeatureRepository.buildSearchFeatureIdsSubquery(filters, systemUserId);
  }
}

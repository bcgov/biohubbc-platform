import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { SearchFeatureResultWithRelevancy } from '../services/search-feature-service.interface';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { dependencies as expressionEvaluation } from './expression-evaluation';
import { buildSecurityFilter, isEffectivelySecured } from './sql-fragments';

/**
 * Repository for searching submission features by expression-tree criteria.
 */
export class SearchFeatureRepository extends BaseRepository {
  private readonly typedPropertyTableNames = [
    'submission_feature_property_string',
    'submission_feature_property_number',
    'submission_feature_property_boolean',
    'submission_feature_property_timestamp',
    'submission_feature_property_geometry',
    'submission_feature_property_code',
    'submission_feature_property_taxon',
    'submission_feature_property_feature'
  ];

  /**
   * Searches for submission features matching the provided expression tree.
   *
   * @param {ExpressionTree} expressionTree - Expression tree criteria
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<SearchFeatureResultWithRelevancy[]>}
   */
  async searchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree: NormalizedExpressionTreeExpression | undefined,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    const knex = getKnex();
    const expressionFeatureIds = expressionTree
      ? expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
          anchorFeatureType,
          expressionTree,
          systemUserId ?? null
        )
      : null;

    let query = this.buildExpressionTreeSearchQuery(knex, anchorFeatureType, expressionFeatureIds, systemUserId);
    query = this.applyExpressionSearchPagination(query, pagination);

    const response = await this.connection.knex(query, SearchFeatureResultWithRelevancy);

    return response.rows;
  }

  /**
   * Gets the count of features matching the provided expression tree.
   *
   * @param {ExpressionTree} expressionTree - Expression tree criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<number>} Promise resolving to the count of matching features
   */
  async searchFeaturesByExpressionTreeCount(
    anchorFeatureType: string,
    expressionTree: NormalizedExpressionTreeExpression | undefined,
    systemUserId?: number | null
  ): Promise<number> {
    const knex = getKnex();
    const expressionFeatureIds = expressionTree
      ? expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
          anchorFeatureType,
          expressionTree,
          systemUserId ?? null
        )
      : null;

    const query = this.buildExpressionTreeSearchQuery(knex, anchorFeatureType, expressionFeatureIds, systemUserId);
    const countQuery = knex.from(query.as('sf_filtered')).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(countQuery);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Gets property metadata for properties that have typed values on the full filtered result set.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {NormalizedExpressionTreeExpression | undefined} expressionTree - Expression tree criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<FeatureTypeProperty[]>} Active property metadata with at least one typed value row.
   */
  async searchFeaturesByExpressionTreeProperties(
    anchorFeatureType: string,
    expressionTree: NormalizedExpressionTreeExpression | undefined,
    systemUserId?: number | null
  ): Promise<FeatureTypeProperty[]> {
    const knex = getKnex();
    const expressionFeatureIds = expressionTree
      ? expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
          anchorFeatureType,
          expressionTree,
          systemUserId ?? null
        )
      : null;
    const matchingFeaturesQuery = this.buildExpressionTreeSearchQuery(
      knex,
      anchorFeatureType,
      expressionFeatureIds,
      systemUserId
    );
    const typedPropertyRowsQuery = knex.unionAll(
      this.typedPropertyTableNames.map((tableName) =>
        knex(`${tableName} as p`)
          .select('p.feature_type_property_id')
          .whereIn('p.submission_feature_id', knex('matching_features').select('submission_feature_id'))
      ),
      true
    );
    const query = knex
      .with('matching_features', matchingFeaturesQuery)
      .with('typed_property_rows', typedPropertyRowsQuery)
      .from('typed_property_rows as tpr')
      .select(
        'ftp.feature_type_property_id',
        'fp.feature_property_id',
        'fpt.feature_property_type_id',
        'fp.name',
        'fp.display_name',
        'fp.description',
        'fpt.name as type_name',
        'ftp.required_value',
        'fp.calculated_value',
        'ftp.allow_multiple'
      )
      .join('feature_type_property as ftp', 'tpr.feature_type_property_id', 'ftp.feature_type_property_id')
      .join('feature_property as fp', 'ftp.feature_property_id', 'fp.feature_property_id')
      .join('feature_property_type as fpt', 'fp.feature_property_type_id', 'fpt.feature_property_type_id')
      .whereNull('ftp.record_end_date')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date')
      .groupBy(
        'ftp.feature_type_property_id',
        'fp.feature_property_id',
        'fpt.feature_property_type_id',
        'fp.name',
        'fp.display_name',
        'fp.description',
        'fpt.name',
        'ftp.required_value',
        'fp.calculated_value',
        'ftp.allow_multiple',
        'ftp.sort'
      )
      .orderByRaw('ftp.sort ASC NULLS LAST')
      .orderBy('fp.display_name', 'asc');

    const response = await this.connection.knex(query, FeatureTypeProperty);

    return response.rows;
  }

  /**
   * Builds the hydrated expression-tree search projection.
   *
   * Hydrates anchor-type feature rows scoped (when provided) by a precomputed expression-tree
   * subquery from `expression-evaluation.buildExpressionTreeFeatureIdsSubquery`.
   * Adds the `is_secured` projection and applies the security WHERE filter.
   *
   * Pagination is applied separately by `applyExpressionSearchPagination` so the count wrapper
   * can wrap this query in `count(*)` without inheriting LIMIT/OFFSET.
   *
   * @param {Knex} knex - Knex instance
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {Knex.QueryBuilder | null} expressionFeatureIds - Subquery returning submission_feature_id
   *   matches for the expression tree, or null when no expression tree was provided.
   * @param {number | null} [systemUserId] - Security context
   * @return {Knex.QueryBuilder} Knex query builder with security filter applied
   */
  private buildExpressionTreeSearchQuery(
    knex: Knex,
    anchorFeatureType: string,
    expressionFeatureIds: Knex.QueryBuilder | null,
    systemUserId?: number | null
  ): Knex.QueryBuilder {
    const expressionResults = knex('submission_feature as sf')
      .distinct()
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`sf.data->>'name' as feature_name`),
        knex.raw(`COALESCE(sf.data->'properties', '{}'::jsonb) as properties`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('ft.name', anchorFeatureType)
      .whereNull('sf.record_end_date')
      .whereNull('ft.record_end_date');

    if (expressionFeatureIds) {
      expressionResults.whereIn('sf.submission_feature_id', expressionFeatureIds);
    }

    const finalQuery = knex
      .from(expressionResults.as('expression_results'))
      .select(
        'submission_feature_id',
        'submission_id',
        'uuid',
        'feature_type_id',
        'feature_type_name',
        'feature_name',
        'properties',
        'submission_name',
        knex.raw(`${isEffectivelySecured('expression_results.submission_feature_id')} AS is_secured`),
        'relevancy_score',
        'create_date'
      );

    if (systemUserId !== undefined) {
      const securityFilter = buildSecurityFilter(knex, systemUserId, 'expression_results.submission_feature_id');

      if (securityFilter) {
        finalQuery.whereRaw(securityFilter);
      }
    }

    return finalQuery;
  }

  /**
   * Applies SQL-side pagination for expression search results.
   *
   * The current public pagination model is page/limit based, so deep pages still use OFFSET. Keep ordering stable by
   * always adding submission_feature_id as the deterministic order key/tie-breaker. A future cursor API can replace
   * this with `submission_feature_id > :cursor ORDER BY submission_feature_id LIMIT :limit` without changing the
   * expression evaluator boundary.
   *
   * @param {Knex.QueryBuilder} query - Final expression search query
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options
   * @return {Knex.QueryBuilder} Query with stable SQL-side pagination applied
   */
  private applyExpressionSearchPagination(
    query: Knex.QueryBuilder,
    pagination?: ApiPaginationOptions
  ): Knex.QueryBuilder {
    if (pagination?.sort && pagination.order) {
      query.orderBy(pagination.sort, pagination.order);
    }

    query.orderBy('submission_feature_id', 'asc');

    if (pagination?.limit) {
      query.limit(pagination.limit);
    }

    if (pagination?.page && pagination.limit) {
      query.offset((pagination.page - 1) * pagination.limit);
    }

    return query;
  }
}

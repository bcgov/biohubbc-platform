import { Feature } from 'geojson';
import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { MAX_SEARCH_GRAPH_DEPTH } from '../constants/expression';
import { getKnex } from '../database/db';
import { ApiBuildSQLError, ApiExecuteSQLError } from '../errors/api-error';
import { InternalTypedPredicate } from '../models/expression-predicate';
import {
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import {
  DatetimeSearchableRecord,
  InsertDatetimeSearchableRecord,
  InsertNumberSearchableRecord,
  InsertSpatialSearchableRecord,
  InsertStringSearchableRecord,
  ISearchFeaturePropertyCondition,
  ISearchFeaturePropertyGroup,
  ISearchFeaturesFilters,
  NumberSearchableRecord,
  SearchComparisonOperator,
  SearchFeatureResultWithRelevancy,
  SpatialSearchableRecord,
  StringSearchableRecord
} from '../services/search-feature-service.interface';
import { normalizeSearchValue } from '../utils/normalize';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { parseTimestamp } from '../utils/timestamp';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { isAccessibleToUser, isEffectivelySecured } from './sql-fragments';

/**
 * Repository for searching submission features by filters.
 * Supports keyword, feature type, species, and property filters with relevancy scoring.
 */
export class SearchFeatureRepository extends BaseRepository {
  /**
   * Deletes all existing search records (string, number, datetime, spatial) for features
   * belonging to the given submission. Used before re-indexing to ensure idempotency —
   * job retries and manual re-indexing would otherwise accumulate duplicate records
   * because the search tables have no unique constraint on (submission_feature_id, feature_property_id).
   *
   * @param {number} submissionId - The submission whose search records should be cleared
   * @return {Promise<void>}
   */
  async deleteSearchRecordsBySubmissionId(submissionId: number): Promise<void> {
    const knex = getKnex();
    const featureIdSubquery = knex
      .select('submission_feature_id')
      .from('submission_feature')
      .where('submission_id', submissionId);

    const tables = ['search_string', 'search_number', 'search_datetime', 'search_spatial'];

    await Promise.all(
      tables.map((table) => {
        const qb = knex.queryBuilder().delete().from(table).whereIn('submission_feature_id', featureIdSubquery);
        return this.connection.knex(qb);
      })
    );
  }

  /**
   * Inserts searchable datetime records into the search_datetime table.
   * @param datetimeRecords - Array of datetime records to insert
   * @returns Promise resolving to array of inserted records with generated IDs
   * @throws ApiExecuteSQLError if row count doesn't match expected
   */
  async insertSearchableDatetimeRecords(
    datetimeRecords: InsertDatetimeSearchableRecord[]
  ): Promise<DatetimeSearchableRecord[]> {
    const qb = getKnex().insert(datetimeRecords).into('search_datetime').returning('*');
    const response = await this.connection.knex(qb, DatetimeSearchableRecord);
    if (response.rowCount !== datetimeRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable datetime records', [
        'SearchFeatureRepository->insertSearchableDatetimeRecords'
      ]);
    }
    return response.rows;
  }

  /**
   * Inserts searchable number records into the search_number table.
   * @param numberRecords - Array of number records to insert
   * @returns Promise resolving to array of inserted records with generated IDs
   * @throws ApiExecuteSQLError if row count doesn't match expected
   */
  async insertSearchableNumberRecords(
    numberRecords: InsertNumberSearchableRecord[]
  ): Promise<NumberSearchableRecord[]> {
    const qb = getKnex().insert(numberRecords).into('search_number').returning('*');
    const response = await this.connection.knex(qb, NumberSearchableRecord);
    if (response.rowCount !== numberRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable number records', [
        'SearchFeatureRepository->insertSearchableNumberRecords'
      ]);
    }
    return response.rows;
  }

  /**
   * Inserts searchable spatial records into the search_spatial table.
   * @param spatialRecords - Array of spatial records with GeoJSON features to insert
   * @returns Promise resolving to array of inserted records with generated IDs
   * @throws ApiExecuteSQLError if row count doesn't match expected
   */
  async insertSearchableSpatialRecords(
    spatialRecords: InsertSpatialSearchableRecord[]
  ): Promise<SpatialSearchableRecord[]> {
    const query = SQL`INSERT INTO search_spatial (submission_feature_id, feature_property_id, value) VALUES`;
    spatialRecords.forEach((record, index) => {
      query.append(SQL`(${record.submission_feature_id}, ${record.feature_property_id},`);
      query.append(generateGeometryCollectionSQL(record.value.features as Feature[]));
      query.append(SQL`)`);
      if (index < spatialRecords.length - 1) {
        query.append(SQL`,`);
      }
    });
    const response = await this.connection.sql(query, SpatialSearchableRecord);
    if (response.rowCount !== spatialRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable spatial records', [
        'SearchFeatureRepository->insertSearchableSpatialRecords'
      ]);
    }
    return response.rows;
  }

  /**
   * Inserts searchable string records into the search_string table.
   * @param stringRecords - Array of string records to insert
   * @returns Promise resolving to array of inserted records with generated IDs
   * @throws ApiExecuteSQLError if row count doesn't match expected
   */
  async insertSearchableStringRecords(
    stringRecords: InsertStringSearchableRecord[]
  ): Promise<StringSearchableRecord[]> {
    const qb = getKnex().insert(stringRecords).into('search_string').returning('*');
    const response = await this.connection.knex(qb, StringSearchableRecord);
    if (response.rowCount !== stringRecords.length) {
      throw new ApiExecuteSQLError('Failed to insert searchable string records', [
        'SearchFeatureRepository->insertSearchableStringRecords'
      ]);
    }
    return response.rows;
  }

  /**
   * Searches for submission features matching the provided filters with relevancy scoring.
   * @param {ISearchFeaturesFilters} filters - Search filters including keyword, feature types, species, and property conditions
   * @param {ApiPaginationOptions} [pagination] - Optional pagination options (page, limit, sort, and order)
   * @returns {Promise<SearchFeatureResultWithRelevancy[]>} Promise resolving to array of matching features with relevancy scores
   */
  async searchFeaturesByFilters(
    filters: ISearchFeaturesFilters,
    pagination?: ApiPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    if (!filters || Object.keys(filters).length === 0) {
      // No filters provided, return empty results
      return [];
    }

    const knex = getKnex();
    let query = this.buildSearchQuery(knex, filters, systemUserId);

    // Apply pagination and sorting using base repository method
    query = this.applyPagination(query, pagination);

    const response = await this.connection.knex(query, SearchFeatureResultWithRelevancy);

    return response.rows;
  }

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
    let query = this.buildExpressionTreeSearchQuery(knex, anchorFeatureType, expressionTree, systemUserId);
    query = this.applyExpressionSearchPagination(query, pagination);

    const response = await this.connection.knex(query, SearchFeatureResultWithRelevancy);

    return response.rows;
  }

  /**
   * Gets the count of features matching the provided search criteria.
   * @param {SearchFeatureFilters} filters - Search filters to count results for
   * @returns {Promise<number>} Promise resolving to the count of matching features
   */
  async searchFeaturesByFiltersCount(filters: ISearchFeaturesFilters, systemUserId?: number | null): Promise<number> {
    const knex = getKnex();
    const query = this.buildSearchQuery(knex, filters, systemUserId);
    const countQuery = knex.from(query.as('sf_filtered')).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(countQuery);
    return response.rows[0]?.count ?? 0;
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
    const query = this.buildExpressionTreeSearchQuery(knex, anchorFeatureType, expressionTree, systemUserId);
    const countQuery = knex.from(query.as('sf_filtered')).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(countQuery);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Returns submission feature IDs matching the provided search filters.
   *
   * Used by POST /api/download to resolve filter criteria into the canonical set of
   * feature IDs for the download pipeline. No pagination — returns ALL matching IDs.
   *
   * @param {ISearchFeaturesFilters} filters - Search filters (keyword, feature_types, species, properties)
   * @returns {Promise<{ submission_feature_id: number }[]>} Raw rows with submission_feature_id
   */
  async searchFeatureIdsByFilters(
    filters: ISearchFeaturesFilters,
    systemUserId?: number | null
  ): Promise<{ submission_feature_id: number }[]> {
    if (!filters || Object.keys(filters).length === 0) {
      return [];
    }

    const subquery = this.buildSearchFeatureIdsSubquery(filters, systemUserId);
    const response = await this.connection.knex(subquery);

    return response.rows;
  }

  /**
   * Build a Knex subquery that returns submission_feature_ids matching the
   * given filters and security context — without executing it.
   *
   * Used by DownloadRepository to compose the search as a SQL subquery
   * inside a larger query, keeping feature resolution entirely in the
   * database (no JS array round-trip for 500K+ ID sets).
   *
   * @param {ISearchFeaturesFilters} filters - Search filters
   * @param {number | null} [systemUserId] - Security context
   * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows
   */
  buildSearchFeatureIdsSubquery(filters: ISearchFeaturesFilters, systemUserId?: number | null): Knex.QueryBuilder {
    const knex = getKnex();
    const query = this.buildSearchQuery(knex, filters, systemUserId);
    return knex.from(query.as('sf_filtered')).select('submission_feature_id');
  }

  /**
   * Builds the search query combining all filter types and CTEs.
   * @param {Knex} knex - Knex instance
   * @param {ISearchFeaturesFilters} filters - Search filters to apply
   * @returns {Knex.QueryBuilder} Knex query builder with all filters applied
   */
  private buildSearchQuery(
    knex: Knex,
    filters: ISearchFeaturesFilters,
    systemUserId?: number | null
  ): Knex.QueryBuilder {
    const keyword = filters.keyword ?? '';
    const featureTypes = filters.feature_types ?? [];
    const speciesFilters = filters.species ?? [];
    const propertyGroups = filters.properties ?? [];
    return this.buildQueryWithCTEs(knex, keyword, featureTypes, speciesFilters, propertyGroups, systemUserId);
  }

  /**
   * Combines all filter CTEs into a single query with intersection and relevancy aggregation.
   * @param {Knex} knex - Knex instance
   * @param {string} keyword - Search keyword for full-text search
   * @param {string[]} featureTypes - Feature type names to filter by
   * @param {string[]} speciesFilters - Species values to filter by
   * @param {ISearchFeaturePropertyGroup[]} propertyGroups - Property condition groups to filter by
   * @returns {Knex.QueryBuilder} Knex query builder with all CTEs and final selection
   */
  private buildQueryWithCTEs(
    knex: Knex,
    keyword: string,
    featureTypes: string[],
    speciesFilters: string[],
    propertyGroups: ISearchFeaturePropertyGroup[],
    systemUserId?: number | null
  ): Knex.QueryBuilder {
    const activeCteCount = [keyword.trim(), featureTypes.length, speciesFilters.length, propertyGroups.length].filter(
      (v) => {
        return typeof v === 'string' ? v.length > 0 : v > 0;
      }
    ).length;

    const query = knex
      .queryBuilder()
      .with('keyword_results', (qb) => {
        if (keyword.trim()) {
          qb.from(this.buildKeywordSearchCTE(keyword, knex).as('kw_results'));
        } else {
          qb.select(knex.raw('null::integer as submission_feature_id, 0 as relevancy_score')).whereRaw('false');
        }
      })
      .with('feature_type_results', (qb) => {
        if (featureTypes.length) {
          qb.from(this.buildFeatureTypeSearchCTE(featureTypes, knex).as('ft_results'));
        } else {
          qb.select(knex.raw('null::integer as submission_feature_id, 0 as relevancy_score')).whereRaw('false');
        }
      })
      .with('species_results', (qb) => {
        if (speciesFilters.length) {
          qb.from(this.buildSpeciesSearchCTE(speciesFilters, knex).as('sp_results'));
        } else {
          qb.select(knex.raw('null::integer as submission_feature_id, 0 as relevancy_score')).whereRaw('false');
        }
      })
      .with('property_results', (qb) => {
        if (propertyGroups.length) {
          qb.from(this.buildPropertySearchCTE(propertyGroups, knex).as('prop_results'));
        } else {
          qb.select(knex.raw('null::integer as submission_feature_id, 0 as relevancy_score')).whereRaw('false');
        }
      })
      .with('active_ctes', (qb) => {
        const activeSets: Knex.QueryBuilder[] = [];
        if (keyword.trim()) {
          activeSets.push(knex('keyword_results').select('*'));
        }
        if (featureTypes.length) {
          activeSets.push(knex('feature_type_results').select('*'));
        }
        if (speciesFilters.length) {
          activeSets.push(knex('species_results').select('*'));
        }
        if (propertyGroups.length) {
          activeSets.push(knex('property_results').select('*'));
        }

        if (activeSets.length === 0) {
          qb.select(
            knex.raw('null::integer as submission_feature_id'),
            knex.raw('null::integer as submission_id'),
            knex.raw('null::uuid as uuid'),
            knex.raw('null::integer as feature_type_id'),
            knex.raw('null::text as feature_type_name'),
            knex.raw('null::text as feature_name'),
            knex.raw('null::text as feature_description'),
            knex.raw('null::text as submission_name'),
            knex.raw('0::integer as relevancy_score'),
            knex.raw('null::text as create_date')
          ).whereRaw('false');
        } else {
          qb.from(activeSets[0]);
          for (let i = 1; i < activeSets.length; i++) {
            qb.unionAll(activeSets[i]);
          }
        }
      })
      .with('intersected_ids', (qb) => {
        qb.select('submission_feature_id')
          .from('active_ctes')
          .groupBy('submission_feature_id')
          .havingRaw(`COUNT(*) = ${activeCteCount}`);
      })
      .with('aggregated_results', (qb) => {
        qb.select(
          'submission_feature_id',
          'submission_id',
          'uuid',
          'feature_type_id',
          'feature_type_name',
          'feature_name',
          'feature_description',
          'submission_name',
          'create_date',
          knex.raw('SUM(relevancy_score) as total_relevancy_score')
        )
          .from('active_ctes')
          .whereIn('submission_feature_id', knex('intersected_ids').select('submission_feature_id'))
          .groupBy(
            'submission_feature_id',
            'submission_id',
            'uuid',
            'feature_type_id',
            'feature_type_name',
            'feature_name',
            'feature_description',
            'submission_name',
            'create_date'
          );
      });

    const finalQuery = query
      .select(
        'submission_feature_id',
        'submission_id',
        'uuid',
        'feature_type_id',
        'feature_type_name',
        'feature_name',
        'feature_description',
        'submission_name',
        knex.raw(`${isEffectivelySecured('aggregated_results.submission_feature_id')} AS is_secured`),
        'total_relevancy_score as relevancy_score',
        'create_date'
      )
      .from('aggregated_results');

    if (systemUserId !== undefined) {
      const securityFilter = this.buildSecurityFilter(knex, systemUserId);

      if (securityFilter) {
        finalQuery.whereRaw(securityFilter);
      }
    }

    return finalQuery;
  }

  /**
   * Builds CTE for keyword-based full-text search in search_string table.
   * Uses PostgreSQL tsvector/tsquery for ranking and relevancy scoring.
   * @param {string} keyword - The search keyword
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder for keyword search CTE
   */
  private buildKeywordSearchCTE(keyword: string, knex: Knex): Knex.QueryBuilder {
    const tsQuery = knex.raw(`plainto_tsquery('english', ?)`, [keyword]);

    const tsVector = knex.raw(`
    to_tsvector(
      'english',
      coalesce(ss.value, '') || ' ' ||
      coalesce(s.name, '') || ' ' ||
      coalesce(sf.data->>'name', '') || ' ' ||
      coalesce(sf.data->>'description', '')
    )
  `);

    return knex('search_string as ss')
      .distinct()
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`sf.data->>'name' as feature_name`),
        knex.raw(`sf.data->>'description' as feature_description`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw(`ts_rank(${tsVector}, ${tsQuery}) as relevancy_score`)
      )
      .join('submission_feature as sf', 'ss.submission_feature_id', 'sf.submission_feature_id')
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .whereRaw(`${tsVector} @@ ${tsQuery}`);
  }

  /**
   * Builds CTE for feature type filtering.
   * @param {string[]} featureTypes - Array of feature type names to filter by
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder for feature type search CTE
   */
  private buildFeatureTypeSearchCTE(featureTypes: string[], knex: Knex): Knex.QueryBuilder {
    return knex('submission_feature as sf')
      .distinct()
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`sf.data->>'name' as feature_name`),
        knex.raw(`sf.data->>'description' as feature_description`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .whereIn('ft.name', featureTypes);
  }

  /**
   * Builds CTE for species filtering.
   * Searches the search_string table for 'species' property matching provided values.
   * @param {string[]} speciesFilters - Array of species values to filter by
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder for species search CTE
   */
  private buildSpeciesSearchCTE(speciesFilters: string[], knex: Knex): Knex.QueryBuilder {
    return knex('search_string as ss')
      .distinct()
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`sf.data->>'name' as feature_name`),
        knex.raw(`sf.data->>'description' as feature_description`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('submission_feature as sf', 'ss.submission_feature_id', 'sf.submission_feature_id')
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .join('feature_property as fp', 'ss.feature_property_id', 'fp.feature_property_id')
      .where('fp.name', 'species')
      .whereIn('ss.value', speciesFilters);
  }

  /**
   * Builds CTE for property-based filtering with complex conditions.
   * Handles multiple property groups with AND/OR operands.
   * @param {ISearchFeaturePropertyGroup[]} propertyGroups - Array of property condition groups
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder for property search CTE
   */
  private buildPropertySearchCTE(propertyGroups: ISearchFeaturePropertyGroup[], knex: Knex): Knex.QueryBuilder {
    const groupQueries = propertyGroups.map((group) => {
      return this.buildPropertyGroupQuery(group, knex);
    });
    let unionQuery = groupQueries[0];
    for (let i = 1; i < groupQueries.length; i++) {
      unionQuery = unionQuery.unionAll(groupQueries[i]);
    }
    return knex
      .from(unionQuery.as('prop_results'))
      .select(
        'submission_feature_id',
        'submission_id',
        'uuid',
        'feature_type_id',
        'feature_type_name',
        'feature_name',
        'feature_description',
        'submission_name',
        'create_date',
        knex.raw('SUM(relevancy_score) as relevancy_score')
      )
      .groupBy(
        'submission_feature_id',
        'submission_id',
        'uuid',
        'feature_type_id',
        'feature_type_name',
        'feature_name',
        'feature_description',
        'submission_name',
        'create_date'
      );
  }

  /**
   * Builds query for a single property group with AND/OR logic.
   * @param {ISearchFeaturePropertyGroup} group - Property group with operand and conditions
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder combining conditions
   */
  private buildPropertyGroupQuery(group: ISearchFeaturePropertyGroup, knex: Knex): Knex.QueryBuilder {
    const conditionQueries = group.conditions.map((cond) => {
      return this.buildConditionQuery(cond, knex);
    });
    let baseQuery = conditionQueries[0];
    if (group.operand === 'and') {
      for (let i = 1; i < conditionQueries.length; i++) {
        baseQuery = baseQuery.intersect(conditionQueries[i]);
      }
    } else {
      for (let i = 1; i < conditionQueries.length; i++) {
        baseQuery = baseQuery.unionAll(conditionQueries[i]);
      }
    }
    return baseQuery;
  }

  /**
   * Builds query for a single property condition across all search types.
   * Unions results from string, number, and datetime search tables with operator applied.
   * @param {ISearchFeaturePropertyCondition} condition - Property condition with name, operator, and value
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder for condition
   */
  private buildConditionQuery(condition: ISearchFeaturePropertyCondition, knex: Knex): Knex.QueryBuilder {
    const stringQuery = this.buildPropertyValueQuery('search_string', condition.name, knex);
    const numberQuery = this.buildPropertyValueQuery('search_number', condition.name, knex);
    const datetimeQuery = this.buildPropertyValueQuery('search_datetime', condition.name, knex);

    const value = normalizeSearchValue(condition.value);

    const stringFiltered = this.applyOperator(stringQuery, 'ss.value', condition.operator, value);
    const numberFiltered = this.applyOperator(numberQuery, 'ss.value', condition.operator, value);
    const datetimeFiltered = this.applyOperator(datetimeQuery, 'ss.value', condition.operator, value);

    return stringFiltered.unionAll(numberFiltered).unionAll(datetimeFiltered);
  }

  /**
   * Builds base query for property value search from a specific search table type.
   * Handles joins to submission_feature, submission, feature_type, and feature_property.
   * @param {string} searchTable - The search table name ('search_string', 'search_number', etc.)
   * @param {string} propertyName - The feature property name to filter by
   * @param {Knex} knex - Knex instance
   * @returns {Knex.QueryBuilder} Knex query builder for property value search
   */
  private buildPropertyValueQuery(searchTable: string, propertyName: string, knex: Knex): Knex.QueryBuilder {
    return knex(`${searchTable} as ss`)
      .distinct()
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`sf.data->>'name' as feature_name`),
        knex.raw(`sf.data->>'description' as feature_description`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('submission_feature as sf', 'ss.submission_feature_id', 'sf.submission_feature_id')
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .join('feature_property as fp', 'ss.feature_property_id', 'fp.feature_property_id')
      .where('fp.name', propertyName);
  }

  /**
   * Applies a comparison operator to a column with the provided value.
   * Supports: eq, neq, gt, gte, lt, lte, contains, starts_with, ends_with, in, not_in, exists
   * @param query - Knex query to apply operator to
   * @param column - Column name to filter
   * @param operator - Comparison operator type
   * @param value - Value to compare (string or array for 'in'/'not_in')
   * @param knex - Knex instance (unused but kept for consistency)
   * @returns Knex query with operator applied
   */
  private applyOperator(
    query: Knex.QueryBuilder,
    column: string,
    operator: SearchComparisonOperator,
    value: string | string[] | number | number[] | boolean
  ): Knex.QueryBuilder {
    switch (operator) {
      case 'eq': {
        return query.whereRaw(`${column} = ?`, [value]);
      }
      case 'neq': {
        return query.whereRaw(`${column} != ?`, [value]);
      }
      case 'gt': {
        return query.whereRaw(`${column} > ?`, [value]);
      }
      case 'gte': {
        return query.whereRaw(`${column} >= ?`, [value]);
      }
      case 'lt': {
        return query.whereRaw(`${column} < ?`, [value]);
      }
      case 'lte': {
        return query.whereRaw(`${column} <= ?`, [value]);
      }
      case 'contains': {
        return query.whereRaw(`${column} ILIKE ?`, [`%${value}%`]);
      }
      case 'starts_with': {
        return query.whereRaw(`${column} ILIKE ?`, [`${value}%`]);
      }
      case 'ends_with': {
        return query.whereRaw(`${column} ILIKE ?`, [`%${value}`]);
      }
      case 'in': {
        const values = Array.isArray(value) ? value : [value].filter((v) => v !== undefined);
        return query.whereIn(column, values as readonly (string | number)[]);
      }
      case 'not_in': {
        const values = Array.isArray(value) ? value : [value].filter((v) => v !== undefined);
        return query.whereNotIn(column, values as readonly (string | number)[]);
      }
      case 'exists': {
        return query.whereNotNull(column);
      }
      default: {
        return query;
      }
    }
  }

  /**
   * Builds the current target-set expression evaluator query.
   *
   * Current evaluator:
   *   predicate -> evidence feature IDs -> bounded graph projection to target IDs
   *   expression AND/OR -> INTERSECT/UNION child target ID sets
   *   final query -> hydrate route target features and apply security/pagination in SQL
   *
   * Future candidate-driven evaluator seam:
   *   start from ordered target candidates, then compile expression clauses into EXISTS predicates against each target.
   *   That avoids materializing the full target set before LIMIT for very large submissions, while preserving the same
   *   public expression semantics.
   *
   * @param {Knex} knex - Knex instance
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {NormalizedExpressionTreeExpression} [expressionTree] - Optional normalized expression tree criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Knex.QueryBuilder} Knex query builder with expression and security filters applied
   */
  private buildExpressionTreeSearchQuery(
    knex: Knex,
    anchorFeatureType: string,
    expressionTree: NormalizedExpressionTreeExpression | undefined,
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
        knex.raw(`sf.data->>'description' as feature_description`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('ft.name', anchorFeatureType)
      .whereNull('sf.record_end_date')
      .whereNull('ft.record_end_date');

    if (expressionTree) {
      const expressionFeatureIds = this.buildExpressionTargetIdsQuery(
        anchorFeatureType,
        expressionTree,
        knex,
        systemUserId
      );
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
        'feature_description',
        'submission_name',
        knex.raw(`${isEffectivelySecured('expression_results.submission_feature_id')} AS is_secured`),
        'relevancy_score',
        'create_date'
      );

    if (systemUserId !== undefined) {
      const securityFilter = this.buildSecurityFilter(knex, systemUserId, 'expression_results.submission_feature_id');

      if (securityFilter) {
        finalQuery.whereRaw(securityFilter);
      }
    }

    return finalQuery;
  }

  /**
   * Recursively builds a target submission_feature_id query for an expression-tree clause.
   *
   * Every child query returns target feature IDs for the route feature type. Predicate clauses first find evidence
   * features that directly satisfy the predicate and then project those evidence features through the graph to target
   * features. Expression clauses combine child target sets with INTERSECT for AND and UNION for OR.
   *
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {ExpressionTreeClause} clause - Expression or predicate clause
   * @param {Knex} knex - Knex instance
   * @param {number | null} [systemUserId] - Security context for evidence features
   * @return {Knex.QueryBuilder} Knex query builder returning target submission_feature_id
   */
  private buildExpressionTargetIdsQuery(
    anchorFeatureType: string,
    clause: NormalizedExpressionTreeClause,
    knex: Knex,
    systemUserId?: number | null,
    aliasPrefix = 'expression_clause'
  ): Knex.QueryBuilder {
    if (clause.type === 'predicate') {
      return this.buildPredicateTargetIdsQuery(anchorFeatureType, clause, knex, systemUserId);
    }

    const clauseQueries = clause.clauses.map((childClause, index) =>
      this.wrapTargetIdsQuery(
        this.buildExpressionTargetIdsQuery(
          anchorFeatureType,
          childClause,
          knex,
          systemUserId,
          `${aliasPrefix}_${index}`
        ),
        knex,
        `${aliasPrefix}_${index}`
      )
    );
    let baseQuery = clauseQueries[0];

    for (let i = 1; i < clauseQueries.length; i++) {
      if (clause.operator === 'AND') {
        baseQuery = baseQuery.intersect(clauseQueries[i]);
      } else {
        baseQuery = baseQuery.union(clauseQueries[i]);
      }
    }

    return baseQuery;
  }

  /**
   * Wraps target ID queries before set operations.
   *
   * Predicate clauses use their own WITH RECURSIVE traversal CTEs. PostgreSQL accepts those CTEs inside a derived
   * table, but not directly as a parenthesized INTERSECT/UNION operand.
   *
   * @param {Knex.QueryBuilder} query - Clause query returning target submission_feature_id
   * @param {Knex} knex - Knex instance
   * @param {string} alias - Derived table alias
   * @return {Knex.QueryBuilder} Wrapped query returning target submission_feature_id
   */
  private wrapTargetIdsQuery(query: Knex.QueryBuilder, knex: Knex, alias: string): Knex.QueryBuilder {
    return knex.select('submission_feature_id').from(query.as(alias));
  }

  /**
   * Builds a target submission_feature_id query for one typed expression predicate.
   *
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {ExpressionTreePredicate} clause - Predicate clause
   * @param {Knex} knex - Knex instance
   * @param {number | null} [systemUserId] - Security context for evidence features
   * @return {Knex.QueryBuilder} Knex query builder returning target submission_feature_id
   */
  private buildPredicateTargetIdsQuery(
    anchorFeatureType: string,
    clause: NormalizedExpressionTreePredicate,
    knex: Knex,
    systemUserId?: number | null
  ): Knex.QueryBuilder {
    const evidenceQuery = this.buildPredicateEvidenceIdsQuery(clause, knex, systemUserId);
    return this.projectEvidenceToTargetIdsQuery(anchorFeatureType, evidenceQuery, knex);
  }

  /**
   * Builds a submission_feature_id query for features that directly satisfy one typed expression predicate.
   *
   * This query is intentionally target-feature agnostic. It only returns evidence features that directly carry a
   * matching property row. When a user security context is present, inaccessible evidence is removed before graph
   * projection so secured evidence cannot influence visible target results.
   *
   * @param {ExpressionTreePredicate} clause - Predicate clause
   * @param {Knex} knex - Knex instance
   * @param {number | null} [systemUserId] - Security context for evidence features
   * @return {Knex.QueryBuilder} Knex query builder returning evidence submission_feature_id
   */
  private buildPredicateEvidenceIdsQuery(
    clause: NormalizedExpressionTreePredicate,
    knex: Knex,
    systemUserId?: number | null
  ): Knex.QueryBuilder {
    const predicate = clause.internal_predicate;
    const { tableName, valueColumn } = this.getPredicateTableConfig(predicate);

    let query = knex(`${tableName} as p`)
      .distinct()
      .select('p.submission_feature_id')
      .join('feature_type_property as ftp', 'ftp.feature_type_property_id', 'p.feature_type_property_id')
      .where('ftp.feature_property_id', clause.feature_property_id)
      .whereNull('ftp.record_end_date');

    if (clause.feature_type_property_id !== null) {
      query = query.where('p.feature_type_property_id', clause.feature_type_property_id);
    }

    if (predicate.type === 'taxon') {
      query = query.join('taxon as t', 't.taxon_id', 'p.taxon_id').whereNull('t.record_end_date');
    }

    if (predicate.type === 'code') {
      query = query
        .join('contributor_codeset_code as csc', 'csc.contributor_codeset_code_id', 'p.contributor_codeset_code_id')
        .join('contributor_codeset as cs', 'cs.contributor_codeset_id', 'csc.contributor_codeset_id')
        .whereNull('csc.record_end_date')
        .whereNull('cs.record_end_date');
    }

    if (predicate.operator === 'NotEquals') {
      query = this.applyExpressionPredicateNotEquals(query, clause, tableName, valueColumn, knex);
    } else {
      query = this.applyExpressionPredicateOperator(query, predicate, valueColumn, knex);
    }

    const securityFilter = this.buildSecurityFilter(knex, systemUserId, 'p.submission_feature_id');

    if (securityFilter) {
      query = query.whereRaw(securityFilter);
    }

    return query;
  }

  /**
   * Projects evidence feature IDs to the requested target feature type.
   *
   * Depth 0 returns evidence that is already the target type. root_feature_id preserves which evidence feature seeded
   * the traversal. path prevents cycles. The route anchor feature type is applied after traversal so every predicate
   * leaf contributes a target set, not an evidence set.
   *
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {Knex.QueryBuilder} evidenceQuery - Query returning evidence submission_feature_id
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Knex query builder returning target submission_feature_id
   */
  private projectEvidenceToTargetIdsQuery(
    anchorFeatureType: string,
    evidenceQuery: Knex.QueryBuilder,
    knex: Knex
  ): Knex.QueryBuilder {
    return knex
      .queryBuilder()
      .with('evidence', evidenceQuery.clone())
      .with('edges', (qb) => {
        qb.select('from_feature_id', 'to_feature_id').from(this.buildGraphEdgesQuery(knex).as('graph_edges'));
      })
      .withRecursive('connected_features', (qb) => {
        qb.select(
          'evidence.submission_feature_id as root_feature_id',
          'evidence.submission_feature_id as connected_feature_id',
          knex.raw('ARRAY[evidence.submission_feature_id] as path'),
          knex.raw('0 as depth')
        )
          .from('evidence')
          .unionAll([
            knex
              .select(
                'connected_features.root_feature_id',
                'edges.to_feature_id as connected_feature_id',
                knex.raw('connected_features.path || edges.to_feature_id as path'),
                knex.raw('connected_features.depth + 1 as depth')
              )
              .from('connected_features')
              .join('edges', 'edges.from_feature_id', 'connected_features.connected_feature_id')
              .where('connected_features.depth', '<', MAX_SEARCH_GRAPH_DEPTH)
              .whereRaw('NOT edges.to_feature_id = ANY(connected_features.path)')
          ]);
      })
      .distinct()
      .select('connected_features.connected_feature_id as submission_feature_id')
      .from('connected_features')
      .join('submission_feature as sf', 'sf.submission_feature_id', 'connected_features.connected_feature_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .where('ft.name', anchorFeatureType)
      .whereNull('sf.record_end_date')
      .whereNull('ft.record_end_date');
  }

  /**
   * Builds normalized direct graph edges as from_feature_id -> to_feature_id.
   *
   * This intentionally uses direct relationships only. The recursive traversal in projectEvidenceToTargetIdsQuery
   * expands over these edges with a depth bound and cycle checks.
   *
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query returning normalized graph edges
   */
  private buildGraphEdgesQuery(knex: Knex): Knex.QueryBuilder {
    return this.buildSubmissionFeatureRelationshipEdgesQuery(knex).unionAll([
      this.buildParentChildEdgesQuery(knex),
      this.buildDatasetSubmissionMembershipEdgesQuery(knex)
    ]);
  }

  /**
   * Builds bidirectional edges from explicit submission_feature_feature relationships.
   *
   * `submission_feature_feature` stores direct edges only and has no record_end_date column. Active-record filtering is
   * applied to the source and target submission_feature rows instead.
   *
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query returning explicit relationship edges in both directions
   */
  private buildSubmissionFeatureRelationshipEdgesQuery(knex: Knex): Knex.QueryBuilder {
    const forward = knex('submission_feature_feature as sff')
      .select('sff.source_feature_id as from_feature_id', 'sff.target_feature_id as to_feature_id')
      .join('submission_feature as source_sf', 'source_sf.submission_feature_id', 'sff.source_feature_id')
      .join('submission_feature as target_sf', 'target_sf.submission_feature_id', 'sff.target_feature_id')
      .whereNull('source_sf.record_end_date')
      .whereNull('target_sf.record_end_date');

    const reverse = knex('submission_feature_feature as sff')
      .select('sff.target_feature_id as from_feature_id', 'sff.source_feature_id as to_feature_id')
      .join('submission_feature as source_sf', 'source_sf.submission_feature_id', 'sff.source_feature_id')
      .join('submission_feature as target_sf', 'target_sf.submission_feature_id', 'sff.target_feature_id')
      .whereNull('source_sf.record_end_date')
      .whereNull('target_sf.record_end_date');

    return forward.unionAll([reverse]);
  }

  /**
   * Builds bidirectional parent/child feature edges.
   *
   * Parent-child links are columns on submission_feature, so active-record filtering is applied to both endpoint rows.
   *
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query returning parent-child edges in both directions
   */
  private buildParentChildEdgesQuery(knex: Knex): Knex.QueryBuilder {
    const parentToChild = knex('submission_feature as child_sf')
      .select(
        'child_sf.parent_submission_feature_id as from_feature_id',
        'child_sf.submission_feature_id as to_feature_id'
      )
      .join(
        'submission_feature as parent_sf',
        'parent_sf.submission_feature_id',
        'child_sf.parent_submission_feature_id'
      )
      .whereNotNull('child_sf.parent_submission_feature_id')
      .whereNull('child_sf.record_end_date')
      .whereNull('parent_sf.record_end_date');

    const childToParent = knex('submission_feature as child_sf')
      .select(
        'child_sf.submission_feature_id as from_feature_id',
        'child_sf.parent_submission_feature_id as to_feature_id'
      )
      .join(
        'submission_feature as parent_sf',
        'parent_sf.submission_feature_id',
        'child_sf.parent_submission_feature_id'
      )
      .whereNotNull('child_sf.parent_submission_feature_id')
      .whereNull('child_sf.record_end_date')
      .whereNull('parent_sf.record_end_date');

    return parentToChild.unionAll([childToParent]);
  }

  /**
   * Builds synthetic dataset-to-same-submission feature edges in both directions.
   *
   * Dataset synthetic edges intentionally connect dataset features to other features in the same submission. This
   * supports dataset-level predicates returning target features from that submission. This can be high fanout for
   * submissions with many features and should be monitored.
   *
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query returning dataset membership edges in both directions
   */
  private buildDatasetSubmissionMembershipEdgesQuery(knex: Knex): Knex.QueryBuilder {
    const datasetToRelated = knex('submission_feature as dataset_sf')
      .select(
        'dataset_sf.submission_feature_id as from_feature_id',
        'related_sf.submission_feature_id as to_feature_id'
      )
      .join('feature_type as dataset_ft', 'dataset_ft.feature_type_id', 'dataset_sf.feature_type_id')
      .join('submission_feature as related_sf', 'related_sf.submission_id', 'dataset_sf.submission_id')
      .where('dataset_ft.name', 'dataset')
      .whereRaw('related_sf.submission_feature_id != dataset_sf.submission_feature_id')
      .whereNull('dataset_ft.record_end_date')
      .whereNull('dataset_sf.record_end_date')
      .whereNull('related_sf.record_end_date');

    const relatedToDataset = knex('submission_feature as dataset_sf')
      .select(
        'related_sf.submission_feature_id as from_feature_id',
        'dataset_sf.submission_feature_id as to_feature_id'
      )
      .join('feature_type as dataset_ft', 'dataset_ft.feature_type_id', 'dataset_sf.feature_type_id')
      .join('submission_feature as related_sf', 'related_sf.submission_id', 'dataset_sf.submission_id')
      .where('dataset_ft.name', 'dataset')
      .whereRaw('related_sf.submission_feature_id != dataset_sf.submission_feature_id')
      .whereNull('dataset_ft.record_end_date')
      .whereNull('dataset_sf.record_end_date')
      .whereNull('related_sf.record_end_date');

    return datasetToRelated.unionAll([relatedToDataset]);
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

  /**
   * Resolves the typed property table and value column for an expression predicate.
   *
   * @param {InternalTypedPredicate} predicate - Typed predicate payload
   * @return {{ tableName: string; valueColumn: string }} Table and value column
   */
  private getPredicateTableConfig(predicate: InternalTypedPredicate): { tableName: string; valueColumn: string } {
    switch (predicate.type) {
      case 'string':
        return { tableName: 'submission_feature_property_string', valueColumn: 'p.value' };
      case 'number':
        return { tableName: 'submission_feature_property_number', valueColumn: 'p.value' };
      case 'boolean':
        return { tableName: 'submission_feature_property_boolean', valueColumn: 'p.value' };
      case 'timestamp':
        return { tableName: 'submission_feature_property_timestamp', valueColumn: 'p.value' };
      case 'taxon':
        return { tableName: 'submission_feature_property_taxon', valueColumn: 'p.taxon_id' };
      case 'geometry':
        return { tableName: 'submission_feature_property_geometry', valueColumn: 'p.value' };
      case 'code':
        return { tableName: 'submission_feature_property_code', valueColumn: 'p.contributor_codeset_code_id' };
      default: {
        const exhaustivePredicate: never = predicate;
        throw new ApiBuildSQLError('Unsupported expression predicate type', [
          'SearchFeatureRepository->getPredicateTableConfig',
          { predicate: exhaustivePredicate }
        ]);
      }
    }
  }

  /**
   * Applies feature-level NotEquals semantics for multi-value property rows.
   *
   * Row-level `p.value <> X` is incorrect for multi-value properties because a feature with
   * values [red, blue] would match `NotEquals red` through the blue row. This predicate means
   * the evidence feature has no row for the semantic property equal to the requested value.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {NormalizedExpressionTreePredicate} clause - Predicate clause
   * @param {string} tableName - Typed property table
   * @param {string} valueColumn - SQL value column
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query with feature-level NotEquals semantics
   */
  private applyExpressionPredicateNotEquals(
    query: Knex.QueryBuilder,
    clause: NormalizedExpressionTreePredicate,
    tableName: string,
    valueColumn: string,
    knex: Knex
  ): Knex.QueryBuilder {
    const columnName = valueColumn.replace('p.', '');
    const value = ('value' in clause.internal_predicate ? clause.internal_predicate.value : undefined) as Knex.Value;

    if (clause.feature_type_property_id !== null) {
      return query.whereNotExists(
        knex(`${tableName} as p_not_equals`)
          .select(knex.raw('1'))
          .whereRaw('p_not_equals.submission_feature_id = p.submission_feature_id')
          .where('p_not_equals.feature_type_property_id', clause.feature_type_property_id)
          .where(`p_not_equals.${columnName}`, value)
      );
    }

    return query.whereNotExists(
      knex(`${tableName} as p_not_equals`)
        .select(knex.raw('1'))
        .join(
          'feature_type_property as ftp_not_equals',
          'ftp_not_equals.feature_type_property_id',
          'p_not_equals.feature_type_property_id'
        )
        .whereRaw('p_not_equals.submission_feature_id = p.submission_feature_id')
        .where('ftp_not_equals.feature_property_id', clause.feature_property_id)
        .where(`p_not_equals.${columnName}`, value)
        .whereNull('ftp_not_equals.record_end_date')
    );
  }

  /**
   * Applies a typed expression predicate operator to a property value query.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {InternalTypedPredicate} predicate - Typed predicate payload
   * @param {string} valueColumn - SQL value column
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query with predicate filter applied
   */
  private applyExpressionPredicateOperator(
    query: Knex.QueryBuilder,
    predicate: InternalTypedPredicate,
    valueColumn: string,
    knex: Knex
  ): Knex.QueryBuilder {
    if (predicate.operator === 'Exists') {
      return query.whereNotNull(valueColumn);
    }

    switch (predicate.type) {
      case 'string':
        return this.applyStringExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
      case 'number':
        return this.applyComparableExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
      case 'boolean':
        return query.where(valueColumn, predicate.value);
      case 'timestamp':
        return this.applyTimestampExpressionOperator(query, valueColumn, predicate);
      case 'taxon':
        return this.applyTaxonExpressionOperator(query, valueColumn, predicate.operator, predicate.value, knex);
      case 'geometry':
        return this.applyGeometryExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
      case 'code':
        return this.applyComparableExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
      default: {
        const exhaustivePredicate: never = predicate;
        throw new ApiBuildSQLError('Unsupported expression predicate type', [
          'SearchFeatureRepository->applyExpressionPredicateOperator',
          { predicate: exhaustivePredicate }
        ]);
      }
    }
  }

  /**
   * Applies a string expression operator.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {string} column - SQL value column
   * @param {InternalTypedPredicate['operator']} operator - Predicate operator
   * @param {string | undefined} value - Predicate value
   * @return {Knex.QueryBuilder} Query with string filter applied
   */
  private applyStringExpressionOperator(
    query: Knex.QueryBuilder,
    column: string,
    operator: InternalTypedPredicate['operator'],
    value: string | undefined
  ): Knex.QueryBuilder {
    switch (operator) {
      case 'Equals':
        return query.where(column, value);
      case 'NotEquals':
        return query.whereNot(column, value);
      case 'Like':
        return query.whereRaw(`${column} LIKE ?`, [value]);
      case 'ILike':
      case 'Contains':
        return query.whereRaw(`${column} ILIKE ?`, [`%${value}%`]);
      case 'StartsWith':
        return query.whereRaw(`${column} ILIKE ?`, [`${value}%`]);
      case 'EndsWith':
        return query.whereRaw(`${column} ILIKE ?`, [`%${value}`]);
      default:
        return query;
    }
  }

  /**
   * Applies an equality/comparison expression operator.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {string} column - SQL value column
   * @param {InternalTypedPredicate['operator']} operator - Predicate operator
   * @param {string | number | boolean | undefined} value - Predicate value
   * @return {Knex.QueryBuilder} Query with comparable filter applied
   */
  private applyComparableExpressionOperator(
    query: Knex.QueryBuilder,
    column: string,
    operator: InternalTypedPredicate['operator'],
    value: string | number | boolean | undefined
  ): Knex.QueryBuilder {
    switch (operator) {
      case 'Equals':
        return query.where(column, value);
      case 'NotEquals':
        return query.whereNot(column, value);
      case 'GreaterThan':
        return query.whereRaw(`${column} > ?`, [value]);
      case 'GreaterThanOrEqual':
        return query.whereRaw(`${column} >= ?`, [value]);
      case 'LessThan':
        return query.whereRaw(`${column} < ?`, [value]);
      case 'LessThanOrEqual':
        return query.whereRaw(`${column} <= ?`, [value]);
      default:
        return query;
    }
  }

  /**
   * Applies a timestamp expression operator.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {string} column - SQL value column
   * @param {Extract<InternalTypedPredicate, { type: 'timestamp' }>} predicate - Timestamp predicate
   * @return {Knex.QueryBuilder} Query with timestamp filter applied
   */
  private applyTimestampExpressionOperator(
    query: Knex.QueryBuilder,
    column: string,
    predicate: Extract<InternalTypedPredicate, { type: 'timestamp' }>
  ): Knex.QueryBuilder {
    if (!predicate.value) {
      return query;
    }

    const value = parseTimestamp(predicate.value);

    if (!value) {
      throw new ApiBuildSQLError('Unsupported timestamp predicate value', [
        'SearchFeatureRepository->applyTimestampExpressionOperator',
        { value: predicate.value }
      ]);
    }

    if (predicate.operator === 'OnDate') {
      return query.whereRaw(`${column} >= ?::date AND ${column} < (?::date + interval '1 day')`, [
        value.date_value,
        value.date_value
      ]);
    }

    if (predicate.operator === 'OnTime') {
      return query.whereRaw(`${column}::time = ?::time`, [value.time_value]);
    }

    const comparator = predicate.operator === 'Before' ? '<' : '>';

    if (value.date_value && value.time_value) {
      return query.whereRaw(`${column} ${comparator} (?::date + ?::time)`, [value.date_value, value.time_value]);
    }

    if (value.date_value) {
      return query.whereRaw(`${column}::date ${comparator} ?::date`, [value.date_value]);
    }

    return query.whereRaw(`${column}::time ${comparator} ?::time`, [value.time_value]);
  }

  /**
   * Applies a taxon expression operator.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {string} column - SQL taxon id column
   * @param {InternalTypedPredicate['operator']} operator - Predicate operator
   * @param {number | undefined} value - Predicate taxon id
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Query with taxon filter applied
   */
  private applyTaxonExpressionOperator(
    query: Knex.QueryBuilder,
    column: string,
    operator: InternalTypedPredicate['operator'],
    value: number | undefined,
    knex: Knex
  ): Knex.QueryBuilder {
    switch (operator) {
      case 'Equals':
        return query.where(column, value);
      case 'ParentOf':
        return query.whereExists(this.buildTaxonAncestorExistsQuery(knex, value, column, false));
      case 'ChildOf':
        return query.whereRaw(
          `NULLIF((SELECT itis_data->>'parentTSN' FROM taxon WHERE taxon_id = ${column}), '')::integer = ` +
            `(SELECT itis_tsn FROM taxon WHERE taxon_id = ?)`,
          [value]
        );
      case 'DescendsFrom':
        return query.whereExists(this.buildTaxonDescendantExistsQuery(knex, value, column));
      case 'AscendsFrom':
        return query.whereExists(this.buildTaxonAncestorExistsQuery(knex, value, column, true));
      default:
        return query;
    }
  }

  /**
   * Builds a recursive query checking whether the candidate taxon is an ancestor of the target taxon.
   *
   * @param {Knex} knex - Knex instance
   * @param {number | undefined} targetTaxonId - Target taxon id
   * @param {string} candidateTaxonColumn - Candidate taxon id column
   * @param {boolean} includeAllAncestors - Whether to include recursive ancestors, not just the direct parent
   * @return {Knex.QueryBuilder} Exists subquery
   */
  private buildTaxonAncestorExistsQuery(
    knex: Knex,
    targetTaxonId: number | undefined,
    candidateTaxonColumn: string,
    includeAllAncestors: boolean
  ): Knex.QueryBuilder {
    const recursiveLimit = includeAllAncestors ? '' : 'WHERE depth = 1';

    return knex.raw(
      `WITH RECURSIVE ancestors AS (
        SELECT taxon_id, itis_tsn, NULLIF(itis_data->>'parentTSN', '')::integer AS parent_tsn, 0 AS depth
        FROM taxon
        WHERE taxon_id = ?
        UNION ALL
        SELECT parent.taxon_id, parent.itis_tsn, NULLIF(parent.itis_data->>'parentTSN', '')::integer, ancestors.depth + 1
        FROM taxon parent
        JOIN ancestors ON parent.itis_tsn = ancestors.parent_tsn
        WHERE parent.record_end_date IS NULL
      )
      SELECT 1
      FROM ancestors
      WHERE taxon_id = ${candidateTaxonColumn}
      ${recursiveLimit}`,
      [targetTaxonId]
    ) as unknown as Knex.QueryBuilder;
  }

  /**
   * Builds a recursive query checking whether the candidate taxon descends from the target taxon.
   *
   * @param {Knex} knex - Knex instance
   * @param {number | undefined} targetTaxonId - Target taxon id
   * @param {string} candidateTaxonColumn - Candidate taxon id column
   * @return {Knex.QueryBuilder} Exists subquery
   */
  private buildTaxonDescendantExistsQuery(
    knex: Knex,
    targetTaxonId: number | undefined,
    candidateTaxonColumn: string
  ): Knex.QueryBuilder {
    return knex.raw(
      `WITH RECURSIVE ancestors AS (
        SELECT taxon_id, itis_tsn, NULLIF(itis_data->>'parentTSN', '')::integer AS parent_tsn
        FROM taxon
        WHERE taxon_id = ${candidateTaxonColumn}
        UNION ALL
        SELECT parent.taxon_id, parent.itis_tsn, NULLIF(parent.itis_data->>'parentTSN', '')::integer
        FROM taxon parent
        JOIN ancestors ON parent.itis_tsn = ancestors.parent_tsn
        WHERE parent.record_end_date IS NULL
      )
      SELECT 1
      FROM ancestors
      WHERE taxon_id = ?`,
      [targetTaxonId]
    ) as unknown as Knex.QueryBuilder;
  }

  /**
   * Applies a geometry expression operator.
   *
   * @param {Knex.QueryBuilder} query - Predicate query
   * @param {string} column - SQL geometry column
   * @param {InternalTypedPredicate['operator']} operator - Predicate operator
   * @param {unknown} value - GeoJSON geometry value
   * @return {Knex.QueryBuilder} Query with geometry filter applied
   */
  private applyGeometryExpressionOperator(
    query: Knex.QueryBuilder,
    column: string,
    operator: InternalTypedPredicate['operator'],
    value: unknown
  ): Knex.QueryBuilder {
    const geometry = 'public.ST_Force2D(public.ST_GeomFromGeoJSON(?))';
    const geoJson = JSON.stringify(value);

    switch (operator) {
      case 'Within':
        return query.whereRaw(`public.ST_Within(${column}, ${geometry})`, [geoJson]);
      case 'Intersects':
        return query.whereRaw(`public.ST_Intersects(${column}, ${geometry})`, [geoJson]);
      case 'Contains':
        return query.whereRaw(`public.ST_Contains(${column}, ${geometry})`, [geoJson]);
      default:
        return query;
    }
  }

  /**
   * Builds a single security filter that walks ancestors once per candidate feature and checks:
   *   1. Unsecured — no ancestor has a submission_feature_security row → visible
   *   2. Secured + granted — any ancestor is a scope anchor the user's team can reach → visible
   *   3. Secured + denied — secured but no matching scope anchor → filtered out
   *
   * For anonymous users (systemUserId is null), only unsecured features pass.
   *
   * Uses shared fragments from `sql-fragments.ts`:
   * - `isEffectivelySecured` — a feature is "effectively secured" only when it or an ancestor
   *   has an active security rule AND the feature is past its `record_effective_date`.
   * - `hasTeamScopeGrant` — walks ancestors to find a scope anchor the user's team can reach.
   *
   * Walk-up (not expand-down) strategy: search filters have already narrowed features
   * to a small candidate set. For each candidate, walk UP the parent chain (~3-5 levels)
   * to check scope anchors. Cost is O(candidates × depth), not O(features in scope).
   *
   * @param knex - Knex instance
   * @param systemUserId - The authenticated user's ID, or null for anonymous.
   * @returns Raw SQL fragment for WHERE clause, or null if no filtering needed.
   */
  private buildSecurityFilter(
    knex: Knex,
    systemUserId: number | null | undefined,
    submissionFeatureIdColumn = 'aggregated_results.submission_feature_id'
  ): Knex.Raw | null {
    if (systemUserId === undefined) {
      return null;
    }

    if (!systemUserId) {
      // Anonymous: only unsecured features
      return knex.raw(`NOT ${isEffectivelySecured(submissionFeatureIdColumn)}`);
    }

    // Authenticated: feature is unsecured OR user has team scope grant (single ancestor walk)
    return knex.raw(`${isAccessibleToUser(submissionFeatureIdColumn)}`, [systemUserId]);
  }
}

import { Feature } from 'geojson';
import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { ApiExecuteSQLError } from '../errors/api-error';
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
import { getLogger } from '../utils/logger';
import { normalizeSearchValue } from '../utils/normalize';
import { generateGeometryCollectionSQL } from '../utils/spatial-utils';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/search-feature-repository');

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
    defaultLog.debug({ label: 'deleteSearchRecordsBySubmissionId', message: 'start', submissionId });

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
    defaultLog.debug({ label: 'insertSearchableDatetimeRecords' });
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
    defaultLog.debug({ label: 'insertSearchableNumberRecords' });
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
    defaultLog.debug({ label: 'insertSearchableSpatialRecords' });
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
    defaultLog.debug({ label: 'insertSearchableStringRecords' });
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
    defaultLog.debug({ label: 'searchFeaturesByFilters', filters, pagination });

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
   * Gets the count of features matching the provided search criteria.
   * @param {ISearchFeaturesFilters} filters - Search filters to count results for
   * @returns {Promise<number>} Promise resolving to the count of matching features
   */
  async searchFeaturesByFiltersCount(filters: ISearchFeaturesFilters, systemUserId?: number | null): Promise<number> {
    defaultLog.debug({ label: 'searchFeaturesByFiltersCount', filters });
    const knex = getKnex();
    const query = this.buildSearchQuery(knex, filters, systemUserId);
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
    defaultLog.debug({ label: 'searchFeatureIdsByFilters', filters });

    if (!filters || Object.keys(filters).length === 0) {
      return [];
    }

    const knex = getKnex();
    const query = this.buildSearchQuery(knex, filters, systemUserId);
    const idsQuery = knex.from(query.as('sf_filtered')).select('submission_feature_id');
    const response = await this.connection.knex(idsQuery);

    return response.rows;
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
        knex.raw(`(
          WITH RECURSIVE ancestors AS (
            SELECT sf_inner.submission_feature_id AS ancestor_id, sf_inner.parent_submission_feature_id
            FROM submission_feature sf_inner
            WHERE sf_inner.submission_feature_id = aggregated_results.submission_feature_id
            UNION ALL
            SELECT p.submission_feature_id, p.parent_submission_feature_id
            FROM submission_feature p
            JOIN ancestors a ON p.submission_feature_id = a.parent_submission_feature_id
          )
          SELECT EXISTS (
            SELECT 1
            FROM ancestors a
            INNER JOIN submission_feature_security sfs ON sfs.submission_feature_id = a.ancestor_id
            INNER JOIN submission_feature sf_sec ON sf_sec.submission_feature_id = a.ancestor_id
            WHERE sfs.record_end_date IS NULL
              AND sf_sec.record_effective_date <= now()
          )
        ) AS is_secured`),
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
   * Builds a single security filter that walks ancestors once per candidate feature and checks:
   *   1. Unsecured — no ancestor has a submission_feature_security row → visible
   *   2. Secured + granted — any ancestor is a scope anchor the user's team can reach → visible
   *   3. Secured + denied — secured but no matching scope anchor → filtered out
   *
   * For anonymous users (systemUserId is null), only unsecured features pass.
   *
   * Uses the shared-ancestor-walk pattern from scale-query-scopes-v2: one recursive CTE
   * produces ancestor_ids, then both the security check and grant check use = ANY(ancestor_ids)
   * against that same array. This avoids the double-walk penalty of separate security + grant queries.
   *
   * Walk-up (not expand-down) strategy: search filters have already narrowed features
   * to a small candidate set. For each candidate, walk UP the parent chain (~3-5 levels)
   * to check scope anchors. Cost is O(candidates × depth), not O(features in scope).
   *
   * @param knex - Knex instance
   * @param systemUserId - The authenticated user's ID, or null for anonymous.
   * @returns Raw SQL fragment for WHERE clause, or null if no filtering needed.
   */
  private buildSecurityFilter(knex: Knex, systemUserId: number | null | undefined): Knex.Raw | null {
    if (systemUserId === undefined) {
      return null;
    }

    if (!systemUserId) {
      // Anonymous: only unsecured features
      return knex.raw(`
        NOT EXISTS (
          WITH RECURSIVE ancestors AS (
            SELECT sf_inner.submission_feature_id AS ancestor_id, sf_inner.parent_submission_feature_id
            FROM submission_feature sf_inner
            WHERE sf_inner.submission_feature_id = aggregated_results.submission_feature_id
            UNION ALL
            SELECT p.submission_feature_id, p.parent_submission_feature_id
            FROM submission_feature p
            JOIN ancestors a ON p.submission_feature_id = a.parent_submission_feature_id
          )
          SELECT 1
          FROM ancestors a
          INNER JOIN submission_feature_security sfs ON sfs.submission_feature_id = a.ancestor_id
          WHERE sfs.record_end_date IS NULL
        )
      `);
    }

    // Authenticated: walk ancestors once, check unsecured OR scope grant
    return knex.raw(
      `
      EXISTS (
        SELECT 1
        FROM (
          WITH RECURSIVE ancestors AS (
            SELECT sf_inner.submission_feature_id AS ancestor_id, sf_inner.parent_submission_feature_id
            FROM submission_feature sf_inner
            WHERE sf_inner.submission_feature_id = aggregated_results.submission_feature_id
            UNION ALL
            SELECT p.submission_feature_id, p.parent_submission_feature_id
            FROM submission_feature p
            JOIN ancestors a ON p.submission_feature_id = a.parent_submission_feature_id
          )
          SELECT array_agg(ancestor_id) AS ancestor_ids
          FROM ancestors
        ) anc
        WHERE
          NOT EXISTS (
            SELECT 1 FROM submission_feature_security sfs
            WHERE sfs.record_end_date IS NULL
              AND sfs.submission_feature_id = ANY(anc.ancestor_ids)
          )
          OR EXISTS (
            SELECT 1
            FROM security_scope_anchor ssa
              JOIN team_security_scope tss ON tss.security_scope_id = ssa.security_scope_id
              JOIN team_member tm ON tm.team_id = tss.team_id
                AND tm.system_user_id = ?
                AND tm.record_end_date IS NULL
            WHERE ssa.anchor_submission_feature_id = ANY(anc.ancestor_ids)
          )
      )
    `,
      [systemUserId]
    );
  }
}

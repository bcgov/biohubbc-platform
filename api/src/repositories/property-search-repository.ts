import { Knex } from 'knex';
import { OperatorsByPropertyType } from '../constants/expression';
import { getKnex, IDBConnection } from '../database/db';
import { ISearchPropertyFilters, SearchPropertyResult } from '../services/property-search-service.interface';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/property-search-repository');

/**
 * Repository for searching feature properties across all searchable tables.
 */
export class PropertySearchRepository extends BaseRepository {
  private readonly supportedPropertyTypes: string[];
  private readonly defaultRelevancyScoreSql: string;
  private readonly keywordRelevancyScoreSql: string;

  /**
   * Build the property search repository.
   *
   * @param {IDBConnection} connection - Active database connection.
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.supportedPropertyTypes = Object.keys(OperatorsByPropertyType);
    this.defaultRelevancyScoreSql = '1.0 as relevancy_score';
    this.keywordRelevancyScoreSql = `
      CASE
        WHEN fp.name ILIKE ? OR fp.display_name ILIKE ? THEN 2.0
        ELSE 1.0
      END as relevancy_score
    `;
  }

  /**
   * Searches feature properties by filters.
   *
   * Performs a search against the feature_property table, matching against property names.
   * Results are paginated and sorted by relevancy score.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria including keyword
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings (page, limit)
   * @return {Promise<SearchPropertyResult[]>} Array of property results
   * @memberof PropertySearchRepository
   */
  async searchProperties(
    filters: ISearchPropertyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SearchPropertyResult[]> {
    defaultLog.debug({ label: 'searchProperties', filters, pagination });

    const knex = getKnex();
    const query = this._buildPropertyQuery(filters, knex);
    this._applyPagination(query, pagination);

    const response = await this.connection.knex(query, SearchPropertyResult);
    return response.rows;
  }

  /**
   * Returns the total count of properties matching the filters.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @return {Promise<number>} Total count of matching properties
   * @memberof PropertySearchRepository
   */
  async searchPropertiesCount(filters: ISearchPropertyFilters): Promise<number> {
    defaultLog.debug({ label: 'searchPropertiesCount', filters });

    const knex = getKnex();
    const query = this._buildPropertyCountQuery(filters, knex);

    const response = await this.connection.knex(query);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Applies pagination settings to a query.
   *
   * Calculates offset based on page and limit, then applies limit and offset to the query.
   *
   * @param {Knex.QueryBuilder} query - Query to apply pagination to
   * @param {ApiPaginationOptions} [pagination] - Pagination settings
   * @return {void}
   * @private
   * @memberof PropertySearchRepository
   */
  private _applyPagination(query: Knex.QueryBuilder, pagination?: ApiPaginationOptions): void {
    if (pagination) {
      const offset = (pagination.page - 1) * pagination.limit;
      query.limit(pagination.limit).offset(offset);
    }
  }

  /**
   * Builds query for feature properties.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} String property query
   * @private
   * @memberof PropertySearchRepository
   */
  private _buildPropertyQuery(filters: ISearchPropertyFilters, knex: Knex): Knex.QueryBuilder {
    const keyword = filters.keyword?.trim() ?? '';

    const query = knex
      .select(
        'fp.feature_property_id',
        'fp.name as property_name',
        'fp.display_name as property_display_name',
        'fpt.name as feature_property_type',
        knex.raw(this.buildOperatorCaseSql()),
        'fpt.name as value_input',
        this.buildRelevancyScoreSql(keyword, knex)
      )
      .from('feature_property as fp')
      .innerJoin('feature_property_type as fpt', 'fp.feature_property_type_id', 'fpt.feature_property_type_id')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date')
      .whereIn('fpt.name', this.supportedPropertyTypes);

    if (keyword) {
      query.where((builder) => {
        builder.where('fp.name', 'ILIKE', `%${keyword}%`).orWhere('fp.display_name', 'ILIKE', `%${keyword}%`);
      });
    }

    return query.orderBy('relevancy_score', 'desc').orderBy('fp.display_name', 'asc');
  }

  /**
   * Builds count query for feature properties.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} String count query
   * @private
   * @memberof PropertySearchRepository
   */
  private _buildPropertyCountQuery(filters: ISearchPropertyFilters, knex: Knex): Knex.QueryBuilder {
    const keyword = filters.keyword?.trim() ?? '';

    const query = knex('feature_property as fp')
      .innerJoin('feature_property_type as fpt', 'fp.feature_property_type_id', 'fpt.feature_property_type_id')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date')
      .whereIn('fpt.name', this.supportedPropertyTypes)
      .select(knex.raw('count(*)::integer as count'));

    if (keyword) {
      query.where((builder) => {
        builder.where('fp.name', 'ILIKE', `%${keyword}%`).orWhere('fp.display_name', 'ILIKE', `%${keyword}%`);
      });
    }

    return query;
  }

  /**
   * Build the SQL CASE expression that exposes allowed operators for each property type.
   *
   * @return {string} SQL fragment for the `operators` projection.
   * @private
   * @memberof PropertySearchRepository
   */
  private buildOperatorCaseSql(): string {
    const cases = Object.entries(OperatorsByPropertyType)
      .map(([propertyType, operators]) => {
        const quotedOperators = operators.map((operator) => `'${operator}'`).join(', ');
        return `WHEN '${propertyType}' THEN ARRAY[${quotedOperators}]`;
      })
      .join('\n            ');

    return `
          CASE fpt.name
            ${cases}
            ELSE ARRAY[]::text[]
          END as operators
        `;
  }

  /**
   * Build the relevancy score projection for property search results.
   *
   * @param {string} keyword - Trimmed search keyword.
   * @param {Knex} knex - Knex instance.
   * @return {Knex.Raw} SQL projection for `relevancy_score`.
   * @private
   * @memberof PropertySearchRepository
   */
  private buildRelevancyScoreSql(keyword: string, knex: Knex): Knex.Raw {
    if (!keyword) {
      return knex.raw(this.defaultRelevancyScoreSql);
    }

    return knex.raw(this.keywordRelevancyScoreSql, [keyword, keyword]);
  }
}

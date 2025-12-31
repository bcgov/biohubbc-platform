import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ISearchPropertyFilters, SearchPropertyResult } from '../services/property-search-service.interface';
import { getLogger } from '../utils/logger';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const defaultLog = getLogger('repositories/property-search-repository');

/**
 * Repository for searching feature properties across all searchable tables.
 * Provides separate methods to search string and number properties.
 */
export class PropertySearchRepository extends BaseRepository {
  /**
   * Searches string properties by filters.
   *
   * Performs a search across the string search table, matching against property names.
   * Results are paginated and sorted by relevancy score.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria including keyword
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings (page, limit)
   * @return {Promise<SearchPropertyResult[]>} Array of string property results
   * @memberof PropertySearchRepository
   */
  async searchStringProperties(
    filters: ISearchPropertyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SearchPropertyResult[]> {
    defaultLog.debug({ label: 'searchStringProperties', filters, pagination });

    const knex = getKnex();
    const query = this._buildStringQuery(filters, knex);
    this._applyPagination(query, pagination);

    const response = await this.connection.knex(query, SearchPropertyResult);
    return response.rows;
  }

  /**
   * Searches number properties by filters.
   *
   * Performs a search across the number search table, matching against property names.
   * Results are paginated and sorted by relevancy score.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria including keyword
   * @param {ApiPaginationOptions} [pagination] - Optional pagination settings (page, limit)
   * @return {Promise<SearchPropertyResult[]>} Array of number property results
   * @memberof PropertySearchRepository
   */
  async searchNumberProperties(
    filters: ISearchPropertyFilters,
    pagination?: ApiPaginationOptions
  ): Promise<SearchPropertyResult[]> {
    defaultLog.debug({ label: 'searchNumberProperties', filters, pagination });

    const knex = getKnex();
    const query = this._buildNumberQuery(filters, knex);
    this._applyPagination(query, pagination);

    const response = await this.connection.knex(query, SearchPropertyResult);
    return response.rows;
  }

  /**
   * Returns the total count of string properties matching the filters.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @return {Promise<number>} Total count of matching string properties
   * @memberof PropertySearchRepository
   */
  async searchStringPropertiesCount(filters: ISearchPropertyFilters): Promise<number> {
    defaultLog.debug({ label: 'searchStringPropertiesCount', filters });

    const knex = getKnex();
    const query = this._buildStringCountQuery(filters, knex);

    const response = await this.connection.knex(query);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Returns the total count of number properties matching the filters.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @return {Promise<number>} Total count of matching number properties
   * @memberof PropertySearchRepository
   */
  async searchNumberPropertiesCount(filters: ISearchPropertyFilters): Promise<number> {
    defaultLog.debug({ label: 'searchNumberPropertiesCount', filters });

    const knex = getKnex();
    const query = this._buildNumberCountQuery(filters, knex);

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
   * Builds query for string properties.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} String property query
   * @private
   * @memberof PropertySearchRepository
   */
  private _buildStringQuery(filters: ISearchPropertyFilters, knex: Knex): Knex.QueryBuilder {
    const keyword = filters.keyword?.trim() ?? '';

    const query = knex
      .distinct('ss.feature_property_id', 'ftp.name as property_name', knex.raw('1.0 as relevancy_score'))
      .from('search_string as ss')
      .innerJoin('feature_property as ftp', 'ss.feature_property_id', 'ftp.feature_property_id');

    if (keyword) {
      query.where('ftp.name', 'ILIKE', `%${keyword}%`);
    }

    return query.orderBy('relevancy_score', 'desc');
  }

  /**
   * Builds query for number properties.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Number property query
   * @private
   * @memberof PropertySearchRepository
   */
  private _buildNumberQuery(filters: ISearchPropertyFilters, knex: Knex): Knex.QueryBuilder {
    const keyword = filters.keyword?.trim() ?? '';

    const query = knex
      .distinct('sn.feature_property_id', 'ftp.name as property_name', knex.raw('1.0 as relevancy_score'))
      .from('search_number as sn')
      .innerJoin('feature_property as ftp', 'sn.feature_property_id', 'ftp.feature_property_id');

    if (keyword) {
      query.where('ftp.name', 'ILIKE', `%${keyword}%`);
    }

    return query.orderBy('relevancy_score', 'desc');
  }

  /**
   * Builds count query for string properties.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} String count query
   * @private
   * @memberof PropertySearchRepository
   */
  private _buildStringCountQuery(filters: ISearchPropertyFilters, knex: Knex): Knex.QueryBuilder {
    const keyword = filters.keyword?.trim() ?? '';

    const query = knex('search_string as ss')
      .innerJoin('feature_property as ftp', 'ss.feature_property_id', 'ftp.feature_property_id')
      .select(knex.raw('count(*)::integer as count'));

    if (keyword) {
      query.where('ftp.name', 'ILIKE', `%${keyword}%`);
    }

    return query;
  }

  /**
   * Builds count query for number properties.
   *
   * @param {ISearchPropertyFilters} filters - Filter criteria
   * @param {Knex} knex - Knex instance
   * @return {Knex.QueryBuilder} Number count query
   * @private
   * @memberof PropertySearchRepository
   */
  private _buildNumberCountQuery(filters: ISearchPropertyFilters, knex: Knex): Knex.QueryBuilder {
    const keyword = filters.keyword?.trim() ?? '';

    const query = knex('search_number as sn')
      .innerJoin('feature_property as ftp', 'sn.feature_property_id', 'ftp.feature_property_id')
      .select(knex.raw('count(*)::integer as count'));

    if (keyword) {
      query.where('ftp.name', 'ILIKE', `%${keyword}%`);
    }

    return query;
  }
}

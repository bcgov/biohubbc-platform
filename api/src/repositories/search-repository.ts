import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { PRIORITY_FEATURE_TYPE } from '../constants/feature-type';
import { getKnex } from '../database/db';
import {
  SearchFeatureResult,
  SearchSubmissionResult,
  SearchSummaryFeature,
  SearchSummarySubmission,
  SearchSummaryTaxon,
  SearchTaxonResult
} from '../models/search';
import { SearchParams, WithCount } from '../services/search-service.interface';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

export class SearchRepository extends BaseRepository {
  /**
   * Builds a query to find features matching a search term.
   * Searches against the search_string table and joins related feature type data.
   *
   * @private
   * @param {string} search - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding features
   * @memberof SearchRepository
   */
  private _makeFindFeaturesQuery(search: string): Knex.QueryBuilder {
    const knex = getKnex();
    return knex('search_string as ss')
      .join('feature_property as fp', 'fp.feature_property_id', 'ss.feature_property_id')
      .join('submission_feature as sf', 'sf.submission_feature_id', 'ss.submission_feature_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .where('fp.name', 'name')
      .andWhereILike('ss.value', `%${search}%`)
      .select('sf.submission_feature_id', 'sf.feature_type_id', knex.raw('MIN(ss.value) as label'))
      .groupBy('sf.submission_feature_id', 'sf.feature_type_id');
  }

  /**
   * Builds a query to find submissions matching a search term.
   * Searches against both submission name and associated search strings.
   *
   * @private
   * @param {string} search - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding submissions
   * @memberof SearchRepository
   */
  private _makeFindSubmissionsQuery(search: string): Knex.QueryBuilder {
    const knex = getKnex();
    return knex('submission as s')
      .leftJoin('submission_feature as sf', 'sf.submission_id', 's.submission_id')
      .leftJoin('search_string as ss', 'ss.submission_feature_id', 'sf.submission_feature_id')
      .where((qb) => {
        qb.whereILike('s.name', `%${search}%`).orWhereILike('ss.value', `%${search}%`);
      })
      .select('s.submission_id', 's.name', 's.description')
      .distinct();
  }

  /**
   * Builds a query to find taxon records matching a search term.
   * Searches against scientific name, common name, BC taxon code, and ITIS TSN.
   *
   * @private
   * @param {string} search - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding taxon records
   * @memberof SearchRepository
   */
  private _makeFindTaxonQuery(search: string): Knex.QueryBuilder {
    const knex = getKnex();
    return knex('taxon')
      .where((qb) => {
        qb.whereILike('itis_scientific_name', `%${search}%`)
          .orWhereILike('common_name', `%${search}%`)
          .orWhereILike('bc_taxon_code', `%${search}%`)
          .orWhereRaw('CAST(itis_tsn AS TEXT) ILIKE ?', [`%${search}%`]);
      })
      .select('taxon_id', knex.raw('itis_scientific_name'));
  }

  /**
   * Wraps a query with CTE and aggregation to return paginated results in the shape { data: [...], total: number }.
   *
   * @private
   * @param {Knex.QueryBuilder} baseQuery - The base query to paginate
   * @param {string} jsonbObjectRaw - Raw SQL for jsonb_build_object with result columns
   * @param {ApiPaginationOptions} [pagination] - Optional pagination parameters
   * @return {Knex.QueryBuilder} Query that returns paginated results with total count
   * @memberof SearchRepository
   */
  private _buildPaginatedQuery(
    baseQuery: Knex.QueryBuilder,
    jsonbObjectRaw: string,
    pagination?: ApiPaginationOptions
  ): Knex.QueryBuilder {
    const knex = getKnex();
    const { page = 1, limit = 25 } = pagination || {};
    const offset = (page - 1) * limit;

    return knex
      .with('total_count', (qb) => {
        qb.from(baseQuery.as('base')).select(knex.raw('COUNT(*)::int as total'));
      })
      .with('paginated', (qb) => {
        qb.from(baseQuery.as('base')).limit(limit).offset(offset);
      })
      .select(
        knex.raw(
          `jsonb_build_object(
          'data', COALESCE(jsonb_agg(${jsonbObjectRaw}), '[]'::jsonb),
          'total', (SELECT total FROM total_count)
        ) as result`
        )
      )
      .from('paginated');
  }

  /**
   * Finds features matching the search term with pagination support.
   * Returns paginated results with total count.
   *
   * @param {SearchParams} params - Object containing the search term
   * @param {ApiPaginationOptions} [pagination] - Optional pagination parameters
   * @return {Promise<WithCount<SearchFeatureResult>>} Paginated feature results and total count
   * @memberof SearchRepository
   */
  async findFeatures(params: SearchParams, pagination?: ApiPaginationOptions): Promise<WithCount<SearchFeatureResult>> {
    const base = this._makeFindFeaturesQuery(params.search);

    if (params.feature_type_name) {
      base.where('ft.name', params.feature_type_name);
    }

    const jsonbObject = `jsonb_build_object('submission_feature_id', submission_feature_id, 'feature_type_id', feature_type_id, 'label', label)`;
    const query = this._buildPaginatedQuery(base, jsonbObject, pagination);

    const result = await this.connection.knex(query);
    return result.rows[0]?.result ?? { data: [], total: 0 };
  }

  /**
   * Finds submissions matching the search term with pagination support.
   * Returns paginated results with total count.
   *
   * @param {SearchParams} params - Object containing the search term
   * @param {ApiPaginationOptions} [pagination] - Optional pagination parameters
   * @return {Promise<WithCount<SearchSubmissionResult>>} Paginated submission results and total count
   * @memberof SearchRepository
   */
  async findSubmissions(
    params: SearchParams,
    pagination?: ApiPaginationOptions
  ): Promise<WithCount<SearchSubmissionResult>> {
    const base = this._makeFindSubmissionsQuery(params.search);
    const jsonbObject = `jsonb_build_object('submission_id', submission_id, 'name', name, 'description', description)`;
    const query = this._buildPaginatedQuery(base, jsonbObject, pagination);

    const result = await this.connection.knex(query);
    return result.rows[0]?.result ?? { data: [], total: 0 };
  }

  /**
   * Finds taxon records matching the search term with pagination support.
   * Returns paginated results with total count.
   *
   * @param {SearchParams} params - Object containing the search term
   * @param {ApiPaginationOptions} [pagination] - Optional pagination parameters
   * @return {Promise<WithCount<SearchTaxonResult>>} Paginated taxon results and total count
   * @memberof SearchRepository
   */
  async findTaxon(params: SearchParams, pagination?: ApiPaginationOptions): Promise<WithCount<SearchTaxonResult>> {
    const base = this._makeFindTaxonQuery(params.search);
    const jsonbObject = `jsonb_build_object('taxon_id', taxon_id, 'itis_scientific_name', itis_scientific_name)`;
    const query = this._buildPaginatedQuery(base, jsonbObject, pagination);

    const result = await this.connection.knex(query);
    return result.rows[0]?.result ?? { data: [], total: 0 };
  }

  /**
   * Returns a summary of features matching the search term, grouped by feature type.
   * Only features with count > 0 are returned.
   *
   * @param {SearchParams} params - Object containing the search term
   * @return {Promise<SearchSummaryFeature[]>} Array of feature type summaries with counts
   * @memberof SearchRepository
   */
  async findFeatureSummary(params: SearchParams): Promise<SearchSummaryFeature[]> {
    const priorityTypes = Object.values(PRIORITY_FEATURE_TYPE);

    const query = SQL`
      WITH matching_features AS (
        SELECT DISTINCT sf.submission_feature_id, sf.feature_type_id
        FROM search_string ss
        JOIN submission_feature sf ON ss.submission_feature_id = sf.submission_feature_id
        WHERE ss.value ILIKE ${`%${params.search}%`}
      ),
      priority_types AS (
        SELECT feature_type_id, name FROM feature_type WHERE name = ANY(${priorityTypes}::text[])
      )
      SELECT 
        pt.name as feature_type_name,
        COALESCE(COUNT(mf.submission_feature_id)::int, 0) as total
      FROM priority_types pt
      LEFT JOIN matching_features mf ON mf.feature_type_id = pt.feature_type_id
      GROUP BY pt.name, pt.feature_type_id
      HAVING COUNT(mf.submission_feature_id) > 0
      ORDER BY total DESC
    `;

    const result = await this.connection.sql(query, SearchSummaryFeature);

    return result.rows;
  }

  /**
   * Returns the number of submissions matching the search criteria.
   *
   * @param {SearchParams} params - Object containing the search term
   * @return {Promise<SearchSummarySubmission>}
   * @memberof SearchRepository
   */
  async findSubmissionSummary(params: SearchParams): Promise<SearchSummarySubmission> {
    const knex = getKnex();
    const query = knex('submission as s')
      .whereILike('s.name', `%${params.search}%`)
      .select(knex.raw('COUNT(*)::int as total'));

    const result = await this.connection.knex(query);
    return SearchSummarySubmission.parse(result.rows[0] ?? { total: 0 });
  }

  /**
   * Returns the number of taxa matching the search criteria.
   *
   * @param {SearchParams} params - Object containing the search term
   * @return {Promise<SearchSummaryTaxon>}
   * @memberof SearchRepository
   */
  async findTaxonSummary(params: SearchParams): Promise<SearchSummaryTaxon> {
    const knex = getKnex();
    const query = knex('taxon')
      .whereILike('itis_scientific_name', `%${params.search}%`)
      .select(knex.raw('COUNT(*)::int as total'));

    const result = await this.connection.knex(query);
    return SearchSummaryTaxon.parse(result.rows[0] ?? { total: 0 });
  }
}

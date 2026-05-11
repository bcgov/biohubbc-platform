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
   *
   * Matches the keyword against any string property in submission_feature_property_string. The
   * returned `label` is the feature's display name (from sf.data->>'name'), so the FE dropdown
   * row and its click-through search query stay recognizable even when the keyword matched a
   * description or other non-name property.
   *
   * Feature types that don't declare a `name` property (e.g. species_observation, animal,
   * capture, measurement, telemetry*) are intentionally excluded from this section — they
   * surface via the Species/taxonomy section and the per-feature-type result page instead.
   * The NULLIF guard also drops rows where `name` is present but empty so the click-through
   * keyword is never blank.
   *
   * @param {string} keyword - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding features
   * @memberof SearchRepository
   */
  private _makeFindFeaturesQuery(keyword: string): Knex.QueryBuilder {
    const knex = getKnex();
    return knex('submission_feature_property_string as sfps')
      .join('submission_feature as sf', 'sf.submission_feature_id', 'sfps.submission_feature_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .whereNull('sf.record_end_date')
      .whereNull('ft.record_end_date')
      .whereILike('sfps.value', `%${keyword}%`)
      .whereRaw(`NULLIF(sf.data->>'name', '') IS NOT NULL`)
      .distinct(
        'sf.submission_feature_id',
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`sf.data->>'name' as label`)
      );
  }

  /**
   * Builds a query to find submissions matching a search term.
   *
   * @param {string} keyword - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding submissions
   * @memberof SearchRepository
   */
  private _makeFindSubmissionsQuery(keyword: string): Knex.QueryBuilder {
    const knex = getKnex();
    return knex('submission as s')
      .leftJoin('submission_feature as sf', function () {
        this.on('sf.submission_id', 's.submission_id').andOnNull('sf.record_end_date');
      })
      .leftJoin('submission_feature_property_string as sfps', 'sfps.submission_feature_id', 'sf.submission_feature_id')
      .whereNull('s.record_end_date')
      .where((qb) => {
        qb.whereILike('s.name', `%${keyword}%`).orWhereILike('sfps.value', `%${keyword}%`);
      })
      .select('s.submission_id', 's.name', 's.description')
      .distinct();
  }

  /**
   * Builds a query to find taxon records matching a search term.
   * Searches against scientific name, common name, BC taxon code, and ITIS TSN.
   *
   * @param {string} keyword - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding taxon records
   * @memberof SearchRepository
   */
  private _makeFindTaxonQuery(keyword: string): Knex.QueryBuilder {
    const knex = getKnex();
    return knex('taxon')
      .where((qb) => {
        qb.whereILike('itis_scientific_name', `%${keyword}%`)
          .orWhereILike('common_name', `%${keyword}%`)
          .orWhereILike('bc_taxon_code', `%${keyword}%`)
          .orWhereRaw('CAST(itis_tsn AS TEXT) ILIKE ?', [`%${keyword}%`]);
      })
      .select('taxon_id', knex.raw('itis_scientific_name'));
  }

  /**
   * Wraps a query with CTE and aggregation to return paginated results in the shape { data: [...], total: number }.
   *
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
    const base = this._makeFindFeaturesQuery(params.keyword);

    if (params.feature_type_name) {
      base.where('ft.name', params.feature_type_name);
    }

    const jsonbObject = `jsonb_build_object('submission_feature_id', submission_feature_id, 'feature_type_id', feature_type_id, 'feature_type_name', feature_type_name, 'label', label)`;
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
    const base = this._makeFindSubmissionsQuery(params.keyword);
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
    const base = this._makeFindTaxonQuery(params.keyword);
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
        FROM submission_feature_property_string sfps
        JOIN submission_feature sf ON sfps.submission_feature_id = sf.submission_feature_id
        WHERE sfps.value ILIKE ${`%${params.keyword}%`}
          AND sf.record_end_date IS NULL
      ),
      priority_types AS (
        SELECT feature_type_id, name FROM feature_type
        WHERE name = ANY(${priorityTypes}::text[])
          AND record_end_date IS NULL
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
      .whereNull('s.record_end_date')
      .whereILike('s.name', `%${params.keyword}%`)
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
      .whereILike('itis_scientific_name', `%${params.keyword}%`)
      .select(knex.raw('COUNT(*)::int as total'));

    const result = await this.connection.knex(query);
    return SearchSummaryTaxon.parse(result.rows[0] ?? { total: 0 });
  }
}

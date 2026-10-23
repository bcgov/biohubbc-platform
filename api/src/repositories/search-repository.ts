import { Knex } from 'knex';
import { LANDING_PAGE_FEATURE_TYPES, PRIORITY_FEATURE_TYPE } from '../constants/feature-type';
import { getKnex } from '../database/db';
import { SearchSummaryFeature, SearchSummarySubmission, SearchSummaryTaxon, SearchTaxonResult } from '../models/search';
import { SearchParams, SearchTaxonFilters, WithCount } from '../services/search-service.interface';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { buildSecurityFilter, isSubmissionFeatureCurrent } from './sql-fragments';

export class SearchRepository extends BaseRepository {
  /**
   * Builds a query to find local taxon records.
   *
   * @param {string} keyword - Taxon search keyword.
   * @return {Knex.QueryBuilder} Query builder for finding local taxon records.
   * @memberof SearchRepository
   */
  private _makeFindTaxonQuery(keyword: string): Knex.QueryBuilder {
    const knex = getKnex();
    const searchTerm = keyword.trim();
    const pattern = `%${searchTerm}%`;

    const query = knex('taxon')
      .select('taxon_id', 'itis_tsn', 'itis_scientific_name', 'common_name', 'rank', knex.raw('1.0 as relevancy_score'))
      .whereNull('record_end_date')
      .orderBy('relevancy_score', 'desc')
      .orderBy('itis_scientific_name', 'asc');

    if (searchTerm) {
      query.where((qb) => {
        qb.whereILike('itis_scientific_name', pattern)
          .orWhereILike('common_name', pattern)
          .orWhereILike('bc_taxon_code', pattern)
          .orWhereRaw('itis_tsn::text ILIKE ?', [pattern]);
      });
    }

    return query;
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
   * Finds local taxon records with pagination support.
   *
   * @param {SearchTaxonFilters} filters - Taxon search filters.
   * @param {ApiPaginationOptions} [pagination] - Optional pagination parameters.
   * @return {Promise<WithCount<SearchTaxonResult>>} Paginated local taxon records and total count.
   * @memberof SearchRepository
   */
  async findTaxon(
    filters: SearchTaxonFilters,
    pagination?: ApiPaginationOptions
  ): Promise<WithCount<SearchTaxonResult>> {
    const base = this._makeFindTaxonQuery(filters.keyword ?? '');
    const jsonbObject = `
      jsonb_build_object(
        'taxon_id', taxon_id,
        'itis_tsn', itis_tsn,
        'itis_scientific_name', itis_scientific_name,
        'common_name', common_name,
        'rank', rank,
        'relevancy_score', relevancy_score
      )
    `;
    const query = this._buildPaginatedQuery(base, jsonbObject, pagination);

    const result = await this.connection.knex(query);
    return result.rows[0]?.result ?? { data: [], total: 0 };
  }

  /**
   * Returns a summary of features matching the search term, grouped by feature type.
   * Only features with count > 0 are returned, and only current features the caller can access are counted.
   *
   * @param {SearchParams} params - Object containing the search term
   * @param {number | null} systemUserId - Caller identity, or null for anonymous (unsecured features only).
   * @return {Promise<SearchSummaryFeature[]>} Array of feature type summaries with counts
   * @memberof SearchRepository
   */
  async findFeatureSummary(params: SearchParams, systemUserId: number | null): Promise<SearchSummaryFeature[]> {
    const knex = getKnex();
    const priorityTypes = Object.values(PRIORITY_FEATURE_TYPE);
    const allowedTypes = [...LANDING_PAGE_FEATURE_TYPES, 'dataset'];
    const pattern = `%${params.keyword}%`;
    // buildSecurityFilter only returns null for unfiltered internal callers; fail closed if that ever changes.
    const securityFilter = buildSecurityFilter(knex, systemUserId, 'sf.submission_feature_id') ?? knex.raw('false');

    const query = knex.raw(
      `
      WITH matching_ids AS (
        SELECT submission_feature_id
          FROM submission_feature_property_string
         WHERE value ILIKE ?
        UNION ALL
        SELECT submission_feature_id
          FROM submission_feature_property_paragraph
         WHERE value ILIKE ?
        UNION ALL
        SELECT p.submission_feature_id
          FROM submission_feature_property_code p
          JOIN contributor_codeset_code c ON c.contributor_codeset_code_id = p.contributor_codeset_code_id
         WHERE c.record_end_date IS NULL
           AND (c.label ILIKE ? OR c.description ILIKE ?)
        UNION ALL
        SELECT p.submission_feature_id
          FROM submission_feature_property_taxon p
          JOIN taxon t ON t.taxon_id = p.taxon_id
         WHERE t.record_end_date IS NULL
           AND ( t.itis_scientific_name ILIKE ?
              OR t.common_name           ILIKE ?
              OR t.bc_taxon_code         ILIKE ?
              OR CAST(t.itis_tsn AS TEXT) ILIKE ? )
      ),
      matching_features AS (
        SELECT DISTINCT sf.submission_feature_id, sf.feature_type_id
          FROM matching_ids m
         JOIN submission_feature sf ON sf.submission_feature_id = m.submission_feature_id
         JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
         WHERE ${isSubmissionFeatureCurrent('sf')}
           AND ?
           AND ft.name = ANY(?::text[])
      ),
      priority_types AS (
        SELECT feature_type_id, name FROM feature_type
        WHERE name = ANY(?::text[])
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
    `,
      [
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        securityFilter,
        allowedTypes,
        priorityTypes
      ]
    );

    const result = await this.connection.knex(query, SearchSummaryFeature);

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
      .whereNull('record_end_date')
      .whereILike('itis_scientific_name', `%${params.keyword}%`)
      .select(knex.raw('COUNT(*)::int as total'));

    const result = await this.connection.knex(query);
    return SearchSummaryTaxon.parse(result.rows[0] ?? { total: 0 });
  }
}

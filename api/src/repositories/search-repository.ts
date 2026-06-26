import { Knex } from 'knex';
import SQL from 'sql-template-strings';
import { LANDING_PAGE_FEATURE_TYPES, PRIORITY_FEATURE_TYPE } from '../constants/feature-type';
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
   * Matches the keyword against three corpora — free-text string properties, codeset code
   * labels/descriptions, and taxon names/codes — and emits one row per matched feature. Only
   * feature types in {@link LANDING_PAGE_FEATURE_TYPES} are eligible. The displayed `label`
   * is the matched value itself, so the dropdown row always reflects *why* the feature
   * surfaced. For types that store a canonical `name` in both `sf.data` and a `_string`
   * property (e.g. study_area, sample_site, survey), a keyword that hits the name produces
   * the name as the matched value — so the name-search UX is preserved.
   *
   * The code arm matches `c.label`, `c.key`, and `c.description`. Keys aren't necessarily
   * numeric — many codesets use human-readable tokens — so they're worth searching despite
   * the occasional bare-integer key. The taxon arm matches scientific/common name, BC taxon
   * code, and ITIS TSN, and prefers the friendliest available label (`common_name` →
   * scientific → BC code → TSN) as the matched value.
   *
   * @param {string} keyword - The search term to match against
   * @return {Knex.QueryBuilder} Query builder for finding features
   * @memberof SearchRepository
   */
  private _makeFindFeaturesQuery(keyword: string): Knex.QueryBuilder {
    const knex = getKnex();
    const pattern = `%${keyword}%`;

    // String arm — match the free-text value.
    const stringMatches = knex('submission_feature_property_string as p')
      .select('p.submission_feature_id', knex.raw('p.value::text as matched_value'))
      .whereILike('p.value', pattern);

    // Code arm — match the display label, key, or description. Keys aren't always numeric;
    // many codesets use human-readable tokens worth searching.
    const codeMatches = knex('submission_feature_property_code as p')
      .join('contributor_codeset_code as c', 'c.contributor_codeset_code_id', 'p.contributor_codeset_code_id')
      .select('p.submission_feature_id', knex.raw('c.label as matched_value'))
      .whereNull('c.record_end_date')
      .where((qb) => {
        qb.whereILike('c.label', pattern).orWhereILike('c.key', pattern).orWhereILike('c.description', pattern);
      });

    // Taxon arm — match scientific/common name, BC code, or TSN. Prefer the friendliest
    // available label for the fragment fallback (common name → scientific name → BC code → TSN).
    const taxonMatches = knex('submission_feature_property_taxon as p')
      .join('taxon as t', 't.taxon_id', 'p.taxon_id')
      .select(
        'p.submission_feature_id',
        knex.raw(
          'COALESCE(t.common_name, t.itis_scientific_name, t.bc_taxon_code, t.itis_tsn::text)::text as matched_value'
        )
      )
      .whereNull('t.record_end_date')
      .where((qb) => {
        qb.whereILike('t.itis_scientific_name', pattern)
          .orWhereILike('t.common_name', pattern)
          .orWhereILike('t.bc_taxon_code', pattern)
          .orWhereRaw('CAST(t.itis_tsn AS TEXT) ILIKE ?', [pattern]);
      });

    const matches = stringMatches.unionAll([codeMatches, taxonMatches]);

    return knex
      .from(matches.as('matches'))
      .join('submission_feature as sf', 'sf.submission_feature_id', 'matches.submission_feature_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
      .whereNull('sf.record_end_date')
      .whereIn('ft.name', [...LANDING_PAGE_FEATURE_TYPES, 'dataset'])
      .groupBy('sf.submission_feature_id', 'sf.feature_type_id', 'ft.name')
      .select(
        'sf.submission_feature_id',
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw('MIN(matches.matched_value) as label')
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
    const allowedTypes = [...LANDING_PAGE_FEATURE_TYPES, 'dataset'];
    const pattern = `%${params.keyword}%`;

    const query = SQL`
      WITH matching_ids AS (
        SELECT submission_feature_id
          FROM submission_feature_property_string
         WHERE value ILIKE ${pattern}
        UNION ALL
        SELECT p.submission_feature_id
          FROM submission_feature_property_code p
          JOIN contributor_codeset_code c ON c.contributor_codeset_code_id = p.contributor_codeset_code_id
         WHERE c.record_end_date IS NULL
           AND (c.label ILIKE ${pattern} OR c.description ILIKE ${pattern})
        UNION ALL
        SELECT p.submission_feature_id
          FROM submission_feature_property_taxon p
          JOIN taxon t ON t.taxon_id = p.taxon_id
         WHERE t.record_end_date IS NULL
           AND ( t.itis_scientific_name ILIKE ${pattern}
              OR t.common_name           ILIKE ${pattern}
              OR t.bc_taxon_code         ILIKE ${pattern}
              OR CAST(t.itis_tsn AS TEXT) ILIKE ${pattern} )
      ),
      matching_features AS (
        SELECT DISTINCT sf.submission_feature_id, sf.feature_type_id
          FROM matching_ids m
         JOIN submission_feature sf ON sf.submission_feature_id = m.submission_feature_id
         JOIN feature_type ft ON ft.feature_type_id = sf.feature_type_id
         WHERE sf.record_end_date IS NULL
           AND ft.name = ANY(${allowedTypes}::text[])
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

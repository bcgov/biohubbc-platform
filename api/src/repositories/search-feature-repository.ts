import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { SearchFeatureResultWithRelevancy } from '../services/search-feature-service.interface';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { dependencies as expressionEvaluation } from './expression-evaluation';
import {
  buildSecurityFilter,
  isAccessibleToUser,
  isEffectivelySecured,
  isSubmissionFeatureActive
} from './sql-fragments';

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

    const query = this.buildExpressionTreeMatchingFeaturesQuery(
      knex,
      anchorFeatureType,
      expressionFeatureIds,
      systemUserId
    );
    const countQuery = knex.from(query.as('sf_filtered')).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(countQuery);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Checks whether the expression matched secured features that are not visible to the caller.
   *
   * This is the source of the `has_more_secured_features` flag. It is a sibling of the visible search
   * query that reuses the same expression criteria and feature-type filter, but deliberately does NOT
   * apply the caller access filter before checking for inaccessible secured matches — otherwise the
   * very features we want to detect would already be removed.
   *
   * Implemented as an `EXISTS`/`LIMIT 1` probe over the unhydrated candidate set:
   * - For authenticated users: true when any matched feature is effectively secured and NOT accessible
   *   to the caller via the anchor-based read path (`isAccessibleToUser`). A caller holding a blanket
   *   grant (e.g. `urn:*:*:*`) over a feature secured before anchor recomputation ran may see a
   *   transient false-positive banner until anchors catch up (a short window, ~10s); this is accepted
   *   so the probe stays consistent with the visible-results access filter (also anchor-only).
   * - For anonymous users: true when any matched feature is effectively secured (none are accessible).
   *
   * No feature data is selected — only the boolean is returned, so no hidden secured rows are exposed.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {NormalizedExpressionTreeExpression | undefined} expressionTree - Expression tree criteria
   * @param {number | null} [systemUserId] - Security context (null = anonymous)
   * @return {Promise<boolean>} True if matching secured features exist that the caller cannot access
   */
  async hasInaccessibleSecuredFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree: NormalizedExpressionTreeExpression | undefined,
    systemUserId?: number | null
  ): Promise<boolean> {
    const knex = getKnex();

    // Candidate anchor features matched by the expression, WITHOUT the caller access filter. The
    // expression subquery already restricts to active anchor-type features, so it is used directly;
    // only the no-expression case needs the feature-type filter from buildExpressionTreeMatchingFeaturesQuery.
    const matchingFeatures = expressionTree
      ? expressionEvaluation.buildUnfilteredExpressionTreeFeatureIdsSubquery(anchorFeatureType, expressionTree)
      : this.buildExpressionTreeMatchingFeaturesQuery(knex, anchorFeatureType, null);

    const existsQuery = knex
      .select(knex.raw('1'))
      .from(matchingFeatures.as('mf'))
      .whereRaw(isEffectivelySecured('mf.submission_feature_id'))
      .limit(1);

    // Authenticated: a secured match is hidden when the caller cannot access it. Reuses the shared
    // isAccessibleToUser check (anchor-based, identical to the visible-results access filter) so the
    // banner stays consistent with which rows are actually shown. The candidate is already effectively
    // secured here, so isAccessibleToUser short-circuits to its team-scope-anchor branch.
    // Anonymous (null/undefined): every secured match is hidden.
    if (systemUserId) {
      existsQuery.whereRaw(`NOT ${isAccessibleToUser('mf.submission_feature_id')}`, [systemUserId]);
    }

    const response = await this.connection.knex(existsQuery);

    return response.rows.length > 0;
  }

  /**
   * Gets metadata for properties with at least one non-null typed value on the full filtered result set.
   * Pagination is intentionally irrelevant. A typed row counts only when its property belongs to the
   * matched feature's feature type, mirroring row-level property hydration.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {NormalizedExpressionTreeExpression | undefined} expressionTree - Expression tree criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<FeatureTypeProperty[]>} Active metadata for properties with at least one non-null value.
   */
  async searchFeaturesByExpressionTreeProperties(
    anchorFeatureType: string,
    expressionTree: NormalizedExpressionTreeExpression | undefined,
    systemUserId?: number | null
  ): Promise<FeatureTypeProperty[]> {
    const knex = getKnex();

    // Compile the normalized expression into an unexecuted feature-id subquery. When there is no
    // expression, the matching-feature query below uses all active features of the anchor type.
    const expressionFeatureIds = expressionTree
      ? expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
          anchorFeatureType,
          expressionTree,
          systemUserId ?? null
        )
      : null;

    // Build the full, security-filtered result set as (submission_feature_id, feature_type_id).
    // This intentionally has no LIMIT/OFFSET: top-level property metadata describes every feature
    // matched by the expression, independently of the page returned in `features`.
    const matchingFeaturesQuery = this.buildExpressionTreeMatchingFeaturesQuery(
      knex,
      anchorFeatureType,
      expressionFeatureIds,
      systemUserId
    );

    // Normalize all indexed typed-property tables to the two columns needed for presence checks.
    // Typed rows represent non-null values. Keeping the matching-feature join outside this
    // UNION means PostgreSQL consumes `matching_features` once instead of once per property table.
    const typedPropertyRowsQuery = knex.unionAll(
      this.typedPropertyTableNames.map((tableName) =>
        knex(`${tableName} as p`).select('p.submission_feature_id', 'p.feature_type_property_id')
      ),
      true
    );

    // Retain property ids that occur on at least one matched feature. The feature-type join mirrors
    // row hydration and rejects stale or unrelated property rows attached to a feature id. Grouping
    // here reduces an arbitrarily large value set to the small set of distinct property ids before
    // descriptive metadata is joined.
    const presentPropertyIdsQuery = knex('typed_property_rows as tpr')
      .select('tpr.feature_type_property_id')
      .join('matching_features as mf', 'tpr.submission_feature_id', 'mf.submission_feature_id')
      .join('feature_type_property as matching_ftp', (join) => {
        join
          .on('tpr.feature_type_property_id', '=', 'matching_ftp.feature_type_property_id')
          .andOn('mf.feature_type_id', '=', 'matching_ftp.feature_type_id');
      })
      .whereNull('matching_ftp.record_end_date')
      .groupBy('tpr.feature_type_property_id');

    // Assemble the three stages as single-use CTEs, then hydrate only the active metadata records
    // for property ids proven to have a non-null value in the full expression result.
    const query = knex
      .with('matching_features', matchingFeaturesQuery)
      .with('typed_property_rows', typedPropertyRowsQuery)
      .with('present_property_ids', presentPropertyIdsQuery)
      .from('present_property_ids as ppi')
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
      .join('feature_type_property as ftp', 'ppi.feature_type_property_id', 'ftp.feature_type_property_id')
      .join('feature_property as fp', 'ftp.feature_property_id', 'fp.feature_property_id')
      .join('feature_property_type as fpt', 'fp.feature_property_type_id', 'fpt.feature_property_type_id')
      .whereNull('ftp.record_end_date')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date')
      .orderByRaw('ftp.sort ASC NULLS LAST')
      .orderBy('fp.display_name', 'asc');

    // Only the compact metadata result crosses the database/application boundary; matching feature
    // ids and typed value rows remain inside PostgreSQL.
    const response = await this.connection.knex(query, FeatureTypeProperty);

    return response.rows;
  }

  /**
   * Builds the filtered set of matching submission features without result hydration.
   *
   * Used by count and property-metadata queries so they do not pay the cost of building
   * row-level properties JSON that they never read.
   *
   * @param {Knex} knex - Knex instance
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {Knex.QueryBuilder | null} expressionFeatureIds - Optional expression-tree matches
   * @param {number | null} [systemUserId] - Security context
   * @return {Knex.QueryBuilder} Query returning submission_feature_id and feature_type_id rows
   */
  private buildExpressionTreeMatchingFeaturesQuery(
    knex: Knex,
    anchorFeatureType: string,
    expressionFeatureIds: Knex.QueryBuilder | null,
    systemUserId?: number | null
  ): Knex.QueryBuilder {
    const query = knex('submission_feature as sf')
      .select('sf.submission_feature_id', 'sf.feature_type_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('ft.name', anchorFeatureType)
      .whereRaw(isSubmissionFeatureActive('sf'));

    if (expressionFeatureIds) {
      query.whereIn('sf.submission_feature_id', expressionFeatureIds);
    }

    if (systemUserId !== undefined) {
      const securityFilter = buildSecurityFilter(knex, systemUserId, 'sf.submission_feature_id');

      if (securityFilter) {
        query.whereRaw(securityFilter);
      }
    }

    return query;
  }

  /**
   * Builds the hydrated expression-tree search projection.
   *
   * Hydrates anchor-type feature rows scoped (when provided) by a precomputed expression-tree
   * subquery from `expression-evaluation.buildExpressionTreeFeatureIdsSubquery`.
   * Feature properties are hydrated from typed property tables rather than
   * `submission_feature.data`, which remains ingestion source JSON only.
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
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        knex.raw(`COALESCE(typed_properties.properties, '{}'::jsonb) as properties`),
        's.name as submission_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('submission as s', 'sf.submission_id', 's.submission_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .joinRaw(this.buildTypedPropertiesLateralJoinSql())
      .where('ft.name', anchorFeatureType)
      .whereRaw(isSubmissionFeatureActive('sf'));

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
   * Builds a lateral join that hydrates the public `properties` JSON object from indexed
   * typed property tables. Multiple rows for the same property, or properties configured
   * as allow_multiple, are surfaced as JSON arrays.
   *
   * Reference-typed properties resolve to structured JSON objects rather than bare scalars, so the
   * UI can render a readable `label` while retaining stable identifiers for linking:
   * - code:    `{ codeset_key, codeset_label, code_key, code_label, label }`
   * - taxon:   `{ taxon_id, tsn, rank, label }`
   * - feature: `{ urn, label }`
   *
   * @return {string} LEFT JOIN LATERAL SQL fragment
   */
  private buildTypedPropertiesLateralJoinSql(): string {
    return `
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(grouped_properties.name, grouped_properties.value ORDER BY grouped_properties.sort, grouped_properties.name) AS properties
        FROM (
          SELECT
            property_values.name,
            MIN(property_values.sort) AS sort,
            CASE
              WHEN BOOL_OR(property_values.allow_multiple) OR COUNT(*) > 1
                THEN jsonb_agg(property_values.value ORDER BY property_values.ordinal)
              ELSE (array_agg(property_values.value ORDER BY property_values.ordinal))[1]
            END AS value
          FROM (
            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_string_id AS ordinal,
              to_jsonb(p.value) AS value
            FROM submission_feature_property_string p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_number_id AS ordinal,
              to_jsonb(p.value) AS value
            FROM submission_feature_property_number p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_boolean_id AS ordinal,
              to_jsonb(p.value) AS value
            FROM submission_feature_property_boolean p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_timestamp_id AS ordinal,
              to_jsonb(
                CASE
                  WHEN p.date_value IS NOT NULL AND p.time_value IS NOT NULL
                    THEN to_char(p.date_value, 'YYYY-MM-DD') || 'T' || to_char(p.time_value, 'HH24:MI:SS')
                  WHEN p.date_value IS NOT NULL
                    THEN to_char(p.date_value, 'YYYY-MM-DD')
                  ELSE to_char(p.time_value, 'HH24:MI:SS')
                END
              ) AS value
            FROM submission_feature_property_timestamp p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_code_id AS ordinal,
              jsonb_build_object(
                'codeset_key', cs.key,
                'codeset_label', cs.label,
                'code_key', ccc.key,
                'code_label', ccc.label,
                'label', ccc.label
              ) AS value
            FROM submission_feature_property_code p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN contributor_codeset_code ccc
              ON ccc.contributor_codeset_code_id = p.contributor_codeset_code_id
            JOIN contributor_codeset cs
              ON cs.contributor_codeset_id = ccc.contributor_codeset_id
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_taxon_id AS ordinal,
              jsonb_build_object(
                'taxon_id', t.taxon_id,
                'tsn', t.itis_tsn,
                'rank', t.rank,
                'label', COALESCE(t.itis_scientific_name, t.common_name, t.bc_taxon_code, t.itis_tsn::text)
              ) AS value
            FROM submission_feature_property_taxon p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN taxon t
              ON t.taxon_id = p.taxon_id
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_geometry_id AS ordinal,
              public.ST_AsGeoJSON(p.value)::jsonb AS value
            FROM submission_feature_property_geometry p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_feature_id AS ordinal,
              jsonb_build_object(
                'urn', referenced_sf.urn,
                'label', referenced_sf.urn
              ) AS value
            FROM submission_feature_property_feature p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN submission_feature referenced_sf
              ON referenced_sf.submission_feature_id = p.referenced_submission_feature_id
             AND ${isSubmissionFeatureActive('referenced_sf')}
            WHERE p.submission_feature_id = sf.submission_feature_id
          ) AS property_values
          GROUP BY property_values.name
        ) AS grouped_properties
      ) AS typed_properties ON true
    `;
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

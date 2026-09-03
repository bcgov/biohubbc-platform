import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiValidationError } from '../errors/api-error';
import { CountResult } from '../models/count';
import { NormalizedExpressionTreeExpression } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { SearchFeatureSort } from '../models/search-feature-pagination';
import { SearchFeatureResultWithRelevancy } from '../services/search-feature-service.interface';
import { ApiCursorPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { dependencies as expressionEvaluation } from './expression-evaluation';
import {
  buildSecurityFilter,
  codePropertyValueJson,
  featureReferencePropertyValueJson,
  isAccessibleToUser,
  isEffectivelySecured,
  isSubmissionFeatureCurrent,
  taxonPropertyValueJson
} from './sql-fragments';

/**
 * Repository for searching submission features by expression-tree criteria.
 */
export class SearchFeatureRepository extends BaseRepository {
  /**
   * Searches for submission features matching the provided expression tree.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {NormalizedExpressionTreeExpression} [expressionTree] - Optional normalized expression tree criteria
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination options
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Ordered, accessible feature rows
   */
  async searchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree?: NormalizedExpressionTreeExpression,
    cursorPagination?: ApiCursorPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    const knex = getKnex();
    const expressionFeatureIds = this.buildExpressionFeatureIdsSubquery(
      anchorFeatureType,
      expressionTree,
      systemUserId
    );

    let query = this.buildExpressionTreeSearchQuery(knex, anchorFeatureType, expressionFeatureIds, systemUserId);
    query = this.applyExpressionSearchCursorPagination(query, cursorPagination);

    const response = await this.connection.knex(query, SearchFeatureResultWithRelevancy);

    return cursorPagination?.boundary?.direction === 'previous' ? response.rows.reverse() : response.rows;
  }

  /**
   * Gets the count of features matching the provided expression tree.
   *
   * @param {string} anchorFeatureType - Target feature type included in the count
   * @param {NormalizedExpressionTreeExpression} [expressionTree] - Optional normalized expression tree criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<number>} Count of matching, accessible features
   */
  async countFeaturesByExpressionTree(
    anchorFeatureType: string,
    expressionTree?: NormalizedExpressionTreeExpression,
    systemUserId?: number | null
  ): Promise<number> {
    const knex = getKnex();
    const expressionFeatureIds = this.buildExpressionFeatureIdsSubquery(
      anchorFeatureType,
      expressionTree,
      systemUserId
    );

    const query = this.buildExpressionTreeMatchingFeaturesQuery(
      knex,
      anchorFeatureType,
      expressionFeatureIds,
      systemUserId
    );
    const countQuery = knex.from(query.as('sf_filtered')).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(countQuery, CountResult);
    return response.rows[0]?.count ?? 0;
  }

  /**
   * Gets active property metadata for the requested feature type.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @return {Promise<FeatureTypeProperty[]>} Active feature type property metadata
   */
  async getFeatureTypeProperties(anchorFeatureType: string): Promise<FeatureTypeProperty[]> {
    const knex = getKnex();
    const query = knex('feature_type_property as ftp')
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
      .join('feature_type as ft', 'ftp.feature_type_id', 'ft.feature_type_id')
      .join('feature_property as fp', 'ftp.feature_property_id', 'fp.feature_property_id')
      .join('feature_property_type as fpt', 'fp.feature_property_type_id', 'fpt.feature_property_type_id')
      .where('ft.name', anchorFeatureType)
      .whereNull('ft.record_end_date')
      .whereNull('ftp.record_end_date')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date')
      .orderByRaw('ftp.sort ASC NULLS LAST')
      .orderBy('fp.display_name', 'asc');

    const response = await this.connection.knex(query, FeatureTypeProperty);
    return response.rows;
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
   * Builds the optional feature-ID subquery shared by result and count searches.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @param {NormalizedExpressionTreeExpression} [expressionTree] - Optional normalized expression criteria
   * @param {number | null} [systemUserId] - Security context
   * @return {Knex.QueryBuilder | null} Matching feature-ID subquery, or null when no expression was supplied
   */
  private buildExpressionFeatureIdsSubquery(
    anchorFeatureType: string,
    expressionTree?: NormalizedExpressionTreeExpression,
    systemUserId?: number | null
  ): Knex.QueryBuilder | null {
    if (!expressionTree) {
      return null;
    }

    return expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
      anchorFeatureType,
      expressionTree,
      systemUserId ?? null
    );
  }

  /**
   * Builds the filtered set of matching submission features without result hydration.
   *
   * Used by count and security-probe queries so they do not pay the cost of
   * building row-level properties JSON that they never read.
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
      .whereRaw(isSubmissionFeatureCurrent('sf'));

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
   * Cursor pagination is applied separately by `applyExpressionSearchCursorPagination`.
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
      .whereRaw(isSubmissionFeatureCurrent('sf'));

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
   * Scalar-typed values are emitted as JSON scalars. Reference-typed values are emitted as
   * structured objects carrying a display `label` plus stable identifiers, built by the shared
   * `sql-fragments` builders so search rows and the feature-detail properties list agree:
   * - taxon: `{ taxon_id, tsn, rank, label }`
   * - code: `{ codeset_key, codeset_label, code_key, code_label, label }`
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
            JOIN feature_property_type fpt
              ON fpt.feature_property_type_id = fp.feature_property_type_id
             AND fpt.name = 'number'
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
              ${codePropertyValueJson('ccc', 'cs')} AS value
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
             AND ccc.record_end_date IS NULL
            JOIN contributor_codeset cs
              ON cs.contributor_codeset_id = ccc.contributor_codeset_id
            WHERE p.submission_feature_id = sf.submission_feature_id

            UNION ALL

            SELECT
              fp.name,
              ftp.sort,
              ftp.allow_multiple,
              p.submission_feature_property_taxon_id AS ordinal,
              ${taxonPropertyValueJson('t')} AS value
            FROM submission_feature_property_taxon p
            JOIN feature_type_property ftp
              ON ftp.feature_type_property_id = p.feature_type_property_id
             AND ftp.feature_type_id = sf.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN feature_property_type fpt
              ON fpt.feature_property_type_id = fp.feature_property_type_id
             AND fpt.name = 'taxon'
            JOIN taxon t
              ON t.taxon_id = p.taxon_id
             AND t.record_end_date IS NULL
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
              ${featureReferencePropertyValueJson('referenced_sf')} AS value
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
             AND ${isSubmissionFeatureCurrent('referenced_sf')}
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
   * Cursor values identify the first row outside the requested page. The unique
   * submission_feature_id is the complete position for ID sorting and the stable
   * tie-breaker for non-unique create_date sorting.
   *
   * @param {Knex.QueryBuilder} query - Final expression search query
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination options
   * @return {Knex.QueryBuilder} Query with stable SQL-side pagination applied
   */
  private applyExpressionSearchCursorPagination(
    query: Knex.QueryBuilder,
    cursorPagination?: ApiCursorPaginationOptions
  ): Knex.QueryBuilder {
    const sort = this.getExpressionSearchSort(cursorPagination);
    const cursorBoundary = cursorPagination?.boundary;
    const reverseSortOrder = sort.order === 'asc' ? 'desc' : 'asc';
    const queryOrder = cursorBoundary?.direction === 'previous' ? reverseSortOrder : sort.order;

    if (cursorBoundary) {
      const comparison = (cursorBoundary.direction === 'next') === (sort.order === 'asc') ? '>' : '<';

      if (sort.sort === 'create_date') {
        // create_date is not unique, so compare it together with the stable ID
        // tie-breaker to resume from one exact position without gaps or duplicates.
        query.whereRaw(`(create_date, submission_feature_id) ${comparison} (?, ?)`, [
          cursorBoundary.create_date,
          cursorBoundary.submission_feature_id
        ]);
      } else {
        // The unique ID is both the active sort value and the complete cursor position.
        query.where('submission_feature_id', comparison, cursorBoundary.submission_feature_id);
      }
    }

    query.orderBy(sort.sort, queryOrder);

    if (sort.sort !== 'submission_feature_id') {
      query.orderBy('submission_feature_id', queryOrder);
    }

    if (cursorPagination?.limit) {
      query.limit(cursorPagination.limit);
    }

    return query;
  }

  /**
   * Resolves the supported database sort and order for a feature search.
   *
   * Relevance currently has no variable score, so it uses stable feature-ID
   * ordering. Explicit ID and creation-date sorts retain their requested order.
   *
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Requested cursor pagination and sorting
   * @return {{ sort: SearchFeatureSort; order: 'asc' | 'desc' }} Validated database sort definition
   */
  private getExpressionSearchSort(cursorPagination?: ApiCursorPaginationOptions): {
    sort: SearchFeatureSort;
    order: 'asc' | 'desc';
  } {
    if (!cursorPagination?.sort || cursorPagination.sort === 'relevancy_score') {
      return { sort: 'submission_feature_id', order: 'asc' };
    }

    const sort = SearchFeatureSort.safeParse(cursorPagination.sort);
    if (!sort.success) {
      throw new ApiValidationError('Unsupported search result sort field');
    }

    return {
      sort: sort.data,
      order: cursorPagination.order ?? 'asc'
    };
  }
}

import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiValidationError } from '../errors/api-error';
import { CountResult } from '../models/count';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { SearchFeatureSort, type SearchFeatureQueryOptions } from '../models/search-feature-pagination';
import { SearchFeatureResultWithRelevancy } from '../services/search-feature-service.interface';
import { ApiCursorPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';
import { dependencies as expressionEvaluation } from './expression-evaluation';
import {
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
   * @param {NormalizedExpressionTree} [expression] - Optional validated and optimized expression criteria
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Optional cursor-pagination options
   * @param {number | null} [systemUserId] - Security context
   * @return {Promise<SearchFeatureResultWithRelevancy[]>} Ordered, accessible feature rows
   */
  async searchFeaturesByExpressionTree(
    anchorFeatureType: string,
    expression?: NormalizedExpressionTree,
    cursorPagination?: ApiCursorPaginationOptions,
    systemUserId?: number | null
  ): Promise<SearchFeatureResultWithRelevancy[]> {
    const knex = getKnex();
    const queryOptions = this.getExpressionSearchQueryOptions(cursorPagination);
    const featureIds = expression
      ? expressionEvaluation.buildExpressionTreeFeatureIdsSubquery(
          anchorFeatureType,
          expression,
          systemUserId ?? null,
          queryOptions
        )
      : expressionEvaluation.buildBroadFeatureTypeSubquery(anchorFeatureType, systemUserId ?? null, queryOptions);

    const query = this.buildExpressionTreeSearchQuery(knex, anchorFeatureType, featureIds, queryOptions);

    const response = await this.connection.knex(query, SearchFeatureResultWithRelevancy);

    return response.rows;
  }

  /**
   * Counts matching anchor features.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search.
   * @param {NormalizedExpressionTree} [expression] - Validated and optimized expression criteria.
   * @param {number | null} [systemUserId] - Security context.
   * @return {Promise<number>} Matching feature count.
   */
  async countFeaturesByExpressionTree(
    anchorFeatureType: string,
    expression?: NormalizedExpressionTree,
    systemUserId?: number | null
  ): Promise<number> {
    const knex = getKnex();
    const featureIds = expression
      ? expressionEvaluation.buildExpressionTreeCountFeatureIdsSubquery(
          anchorFeatureType,
          expression,
          systemUserId ?? null
        )
      : expressionEvaluation.buildBroadFeatureTypeCountSubquery(anchorFeatureType, systemUserId ?? null);
    const countQuery = knex.from(featureIds.as('matching_features')).select(knex.raw('count(*)::integer as count'));
    const response = await this.connection.knex(countQuery, CountResult);

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
   * @param {NormalizedExpressionTree} [expression] - Validated and optimized expression criteria
   * @param {number | null} [systemUserId] - Security context (null = anonymous)
   * @return {Promise<boolean>} True if matching secured features exist that the caller cannot access
   */
  async hasInaccessibleSecuredFeaturesByExpressionTree(
    anchorFeatureType: string,
    expression?: NormalizedExpressionTree,
    systemUserId?: number | null
  ): Promise<boolean> {
    const knex = getKnex();

    const expressionFeatureIds = expression
      ? expressionEvaluation.buildUnfilteredExpressionTreeFeatureIdsSubquery(anchorFeatureType, expression)
      : null;

    // Start from the tiny active-security set and project through closure to matching candidates. Broad
    // searches commonly have millions of unsecured matches; scanning all of them just to prove the
    // hidden-secured banner is false is the wrong direction.
    const existsQuery = knex('submission_feature_security as sfs')
      .select(knex.raw('1'))
      .join('submission_feature_closure as ancestry', (join) => {
        join
          .on('ancestry.target_submission_feature_id', '=', 'sfs.submission_feature_id')
          .andOn('ancestry.is_ancestor', '=', knex.raw('true'));
      })
      .join('submission_feature as sf', 'sf.submission_feature_id', 'ancestry.source_submission_feature_id')
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('ft.name', anchorFeatureType)
      .whereNull('ft.record_end_date')
      .where('sfs.status', 'active')
      .whereRaw('sfs.record_effective_date <= now()')
      .where((activeSecurity) => {
        activeSecurity.whereNull('sfs.record_end_date').orWhereRaw('now() < sfs.record_end_date');
      })
      .whereExists(
        knex('submission_feature_closure as sfc')
          .select(knex.raw('1'))
          .whereRaw('sfc.source_submission_feature_id = sf.submission_feature_id')
          .whereRaw('sfc.target_submission_feature_id = sf.submission_feature_id')
      )
      .limit(1);

    if (expressionFeatureIds) {
      existsQuery.join(expressionFeatureIds.clone().as('expression_matches'), function () {
        this.on('expression_matches.submission_feature_id', '=', 'sf.submission_feature_id');
      });
    }

    // Authenticated: a secured match is hidden when the caller cannot access it. Reuses the shared
    // isAccessibleToUser check (anchor-based, identical to the visible-results access filter) so the
    // banner stays consistent with which rows are actually shown. The candidate is already effectively
    // secured here, so isAccessibleToUser short-circuits to its team-scope-anchor branch.
    // Anonymous (null/undefined): every secured match is hidden.
    if (systemUserId) {
      existsQuery.whereRaw(`NOT ${isAccessibleToUser('sf.submission_feature_id')}`, [systemUserId]);
    }

    const response = await this.connection.knex(existsQuery);

    return response.rows.length > 0;
  }

  /**
   * Gets the active property schema for the anchor feature type.
   *
   * Property definitions are type metadata, not search-result data. Keeping this query independent
   * of the expression prevents the full expression from being evaluated once per typed value table.
   *
   * @param {string} anchorFeatureType - Target feature type returned by the search
   * @return {Promise<FeatureTypeProperty[]>} Active metadata for the anchor feature type.
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
      .whereNull('ftp.record_end_date')
      .whereNull('ft.record_end_date')
      .whereNull('fp.record_end_date')
      .whereNull('fpt.record_end_date')
      .orderByRaw('ftp.sort ASC NULLS LAST')
      .orderBy('fp.display_name', 'asc');
    const response = await this.connection.knex(query, FeatureTypeProperty);

    return response.rows;
  }

  /**
   * Builds the hydrated expression-tree search projection.
   *
   * Hydrates anchor-type feature rows scoped (when provided) by a precomputed expression-tree
   * subquery from `expression-evaluation.buildExpressionTreeFeatureIdsSubquery`.
   * Feature properties are hydrated from typed property tables rather than
   * `submission_feature.data`, which remains ingestion source JSON only.
   * Applies expression/closure/security filters before pagination, then hydrates the typed property
   * JSON only for the authorized page of features.
   *
   * @param {Knex} knex - Knex instance
   * @param {string} anchorFeatureType - Route anchor/result feature type
   * @param {Knex.QueryBuilder} featureIds - Paginated subquery returning matching submission_feature_id values.
   * @param {SearchFeatureQueryOptions} queryOptions - Applied cursor pagination and sort options
   * @return {Knex.QueryBuilder} Knex query builder with security filter applied
   */
  private buildExpressionTreeSearchQuery(
    knex: Knex,
    anchorFeatureType: string,
    featureIds: Knex.QueryBuilder,
    queryOptions: SearchFeatureQueryOptions
  ): Knex.QueryBuilder {
    const authorizedFeatures = knex
      .from(featureIds.clone().as('expression_matches'))
      .join('submission_feature as sf', 'sf.submission_feature_id', 'expression_matches.submission_feature_id');

    authorizedFeatures
      .select(
        'sf.submission_feature_id',
        'sf.submission_id',
        knex.raw('sf.uuid::text as uuid'),
        'sf.feature_type_id',
        'ft.name as feature_type_name',
        'sf.create_date',
        knex.raw('1.0 as relevancy_score')
      )
      .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
      .where('ft.name', anchorFeatureType)
      .whereNull('ft.record_end_date');

    const finalQuery = knex
      .from(authorizedFeatures.as('authorized_features'))
      .select(
        'authorized_features.submission_feature_id',
        'authorized_features.submission_id',
        'authorized_features.uuid',
        'authorized_features.feature_type_id',
        'authorized_features.feature_type_name',
        knex.raw(`COALESCE(typed_properties.properties, '{}'::jsonb) as properties`),
        's.name as submission_name',
        knex.raw(`${isEffectivelySecured('authorized_features.submission_feature_id')} AS is_secured`),
        'authorized_features.relevancy_score',
        'authorized_features.create_date'
      )
      .join('submission as s', 'authorized_features.submission_id', 's.submission_id')
      .joinRaw(this.buildTypedPropertiesLateralJoinSql());

    this.applyExpressionSearchOrder(finalQuery, 'authorized_features', queryOptions);

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN feature_property_type fpt
              ON fpt.feature_property_type_id = fp.feature_property_type_id
             AND fpt.name = 'number'
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN contributor_codeset_code ccc
              ON ccc.contributor_codeset_code_id = p.contributor_codeset_code_id
             AND ccc.record_end_date IS NULL
            JOIN contributor_codeset cs
              ON cs.contributor_codeset_id = ccc.contributor_codeset_id
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
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
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            WHERE p.submission_feature_id = authorized_features.submission_feature_id

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
             AND ftp.feature_type_id = authorized_features.feature_type_id
             AND ftp.record_end_date IS NULL
            JOIN feature_property fp
              ON fp.feature_property_id = ftp.feature_property_id
             AND fp.record_end_date IS NULL
            JOIN submission_feature referenced_sf
              ON referenced_sf.submission_feature_id = p.referenced_submission_feature_id
             AND ${isSubmissionFeatureCurrent('referenced_sf')}
            WHERE p.submission_feature_id = authorized_features.submission_feature_id
          ) AS property_values
          GROUP BY property_values.name
        ) AS grouped_properties
      ) AS typed_properties ON true
    `;
  }

  /**
   * Applies stable SQL-side ordering for expression search results.
   *
   * @example
   * Sorting by `create_date DESC` adds `submission_feature_id DESC` as a deterministic tie-breaker. Sorting directly by
   * `submission_feature_id` adds no second order column because the primary key is already unique.
   *
   * @param {Knex.QueryBuilder} query - Search query
   * @param {string} tableAlias - Table alias used to qualify sortable columns.
   * @param {SearchFeatureQueryOptions} options - Cursor pagination and sort options
   * @return {Knex.QueryBuilder} Query with stable ordering applied
   */
  private applyExpressionSearchOrder(
    query: Knex.QueryBuilder,
    tableAlias: string,
    options: SearchFeatureQueryOptions
  ): Knex.QueryBuilder {
    query.orderBy(`${tableAlias}.${options.sort}`, options.order);

    if (options.sort !== 'submission_feature_id') {
      query.orderBy(`${tableAlias}.submission_feature_id`, options.order);
    }

    return query;
  }

  /**
   * Resolves the supported database sort and order for a feature search.
   *
   * Relevance currently has no variable score, so it uses stable feature-ID
   * ordering. Explicit ID and creation-date sorts retain their requested order.
   *
   * @example
   * An omitted sort or `relevancy_score` returns `{ sort: 'submission_feature_id', order: 'asc' }`.
   * `{ sort: 'create_date', order: 'desc' }` remains unchanged after validation.
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
      order: cursorPagination.order
    };
  }

  /**
   * Builds the normalized query options used to page the feature-ID subquery before hydration.
   *
   * The request boundary is already decoded and validated at the HTTP boundary. Only positional
   * values needed by the active sort are used to resume the query.
   *
   * @example
   * Input: `{ limit: 25, sort: 'create_date', order: 'desc', boundary }`
   * Output: `{ limit: 25, sort: 'create_date', order: 'desc', boundary }`
   *
   * Relevancy sorting is resolved earlier to stable feature-ID ordering because expression search currently has no
   * variable relevance score.
   *
   * @param {ApiCursorPaginationOptions} [cursorPagination] - Requested cursor pagination and sorting
   * @return {SearchFeatureQueryOptions} Database sort, boundary, and optional page limit
   */
  private getExpressionSearchQueryOptions(cursorPagination?: ApiCursorPaginationOptions): SearchFeatureQueryOptions {
    const sort = this.getExpressionSearchSort(cursorPagination);

    return {
      ...sort,
      ...(cursorPagination?.boundary && { boundary: cursorPagination.boundary }),
      ...(cursorPagination?.limit && { limit: cursorPagination.limit })
    };
  }
}

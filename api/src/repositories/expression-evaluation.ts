import { Knex } from 'knex';
import { MAX_SEARCH_GRAPH_DEPTH } from '../constants/expression';
import { getKnex } from '../database/db';
import { ApiBuildSQLError } from '../errors/api-error';
import { InternalTypedPredicate } from '../models/expression-predicate';
import {
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import { parseTimestamp } from '../utils/timestamp';
import { buildSecurityFilter } from './sql-fragments';

/**
 * Pure SQL builders that compile a normalized expression tree into Knex
 * subqueries returning matching submission_feature_id values for an anchor
 * feature type.
 *
 * Each predicate compiles into a bounded recursive content walk plus closure
 * probes: a `WITH RECURSIVE` CTE walks the `submission_feature_feature` content
 * (`data.content`) edges the closure deliberately omits, and the precomputed
 * `submission_feature_closure` table is probed from every content-reached node
 * to resolve parent-ancestry and property-reference reach with indexed joins.
 *
 * Read-time evaluator shared by the search wrapper (POST /api/search/feature)
 * and the download pipeline (POST /api/download). Both paths consume the same
 * emitted SQL, so a single substrate keeps semantics — including security
 * filtering — identical across both consumers.
 *
 * Inputs are assumed to be normalized: semantic validation runs at write time
 * inside `writeExpressionTree`. These functions only emit SQL.
 *
 * Shape parallels `sql-fragments.ts`: stateless module functions that emit
 * knex QueryBuilders without ever executing SQL or holding a connection.
 */

/**
 * Build a Knex subquery that returns submission_feature_id rows matching the
 * given normalized expression tree, scoped to the anchor feature type, with
 * the security filter applied for the given system user — without executing.
 *
 * Used by:
 * - `SearchFeatureRepository.searchFeaturesByExpressionTree(...)` to drive the
 *   hydrated search projection.
 * - The download pipeline to compose the resolved feature set as a SQL
 *   subquery inside a streaming cursor (no JS array round-trip for large ID
 *   sets).
 *
 * @param {string} anchorFeatureType - Route anchor/result feature type
 * @param {NormalizedExpressionTreeExpression} normalizedExpression - Normalized expression tree criteria
 * @param {number | null} systemUserId - Security context (null = anonymous)
 * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows
 */
export function buildExpressionTreeFeatureIdsSubquery(
  anchorFeatureType: string,
  normalizedExpression: NormalizedExpressionTreeExpression,
  systemUserId: number | null
): Knex.QueryBuilder {
  const knex = getKnex();
  return buildExpressionTargetIdsQuery(anchorFeatureType, normalizedExpression, knex, systemUserId);
}

/**
 * Build a Knex subquery that returns every active submission_feature_id for the given
 * feature type, with the security filter applied for the given user — the broad,
 * no-expression-filter projection used when a policy statement carries no expression
 * link.
 *
 * Counterpart to `buildExpressionTreeFeatureIdsSubquery` for the broad path. The
 * security filter is the only gate against a runaway export when no expression is
 * present, so it must always be composed in.
 *
 * @param {string} featureTypeName - The feature type name to project.
 * @param {number | null} systemUserId - Security context (null = anonymous, only unsecured features).
 * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows.
 */
export function buildBroadFeatureTypeSubquery(featureTypeName: string, systemUserId: number | null): Knex.QueryBuilder {
  const knex = getKnex();
  let query = knex('submission_feature as sf')
    .select('sf.submission_feature_id')
    .join('feature_type as ft', 'sf.feature_type_id', 'ft.feature_type_id')
    .where('ft.name', featureTypeName)
    .whereNull('sf.record_end_date')
    .whereNull('ft.record_end_date');

  const securityFilter = buildSecurityFilter(knex, systemUserId, 'sf.submission_feature_id');
  if (securityFilter) {
    query = query.whereRaw(securityFilter);
  }

  return query;
}

/**
 * Build a Knex subquery that returns submission_feature_id rows matching the given normalized
 * expression tree, scoped to the anchor feature type, WITHOUT any security/access filtering.
 *
 * This is the expression-matched candidate set *before* the caller access filter is applied.
 * It exists solely to detect whether a search matched secured features the caller cannot see
 * (`has_more_secured_features`) — it must never be used to return feature rows to a caller,
 * because it does not exclude inaccessible secured features.
 *
 * Routes through the same `buildExpressionTargetIdsQuery` substrate as the filtered variant, but
 * passes `systemUserId = undefined` so `buildSecurityFilter` returns `null` at every layer (both
 * the evidence-level and target-level filters), leaving the candidate set unfiltered.
 *
 * @param {string} anchorFeatureType - Route anchor/result feature type
 * @param {NormalizedExpressionTreeExpression} normalizedExpression - Normalized expression tree criteria
 * @return {Knex.QueryBuilder} Unexecuted subquery returning submission_feature_id rows, no security filter applied
 */
export function buildUnfilteredExpressionTreeFeatureIdsSubquery(
  anchorFeatureType: string,
  normalizedExpression: NormalizedExpressionTreeExpression
): Knex.QueryBuilder {
  const knex = getKnex();
  return buildExpressionTargetIdsQuery(anchorFeatureType, normalizedExpression, knex, undefined);
}

/**
 * Stubbable dependency surface. Production callers route through this bag so
 * tests can replace individual builders with sinon stubs (ESM exports cannot
 * be reassigned directly).
 */
export const dependencies = {
  buildExpressionTreeFeatureIdsSubquery,
  buildBroadFeatureTypeSubquery,
  buildUnfilteredExpressionTreeFeatureIdsSubquery
};

/**
 * Recursively builds a target submission_feature_id query for an expression-tree clause.
 *
 * Every child query returns target feature IDs for the route feature type. Predicate clauses first find evidence
 * features that directly satisfy the predicate and then project those evidence features to related target
 * features. Expression clauses combine child target sets with INTERSECT for AND and UNION for OR.
 */
function buildExpressionTargetIdsQuery(
  anchorFeatureType: string,
  clause: NormalizedExpressionTreeClause,
  knex: Knex,
  systemUserId?: number | null,
  aliasPrefix = 'expression_clause'
): Knex.QueryBuilder {
  if (clause.type === 'predicate') {
    return buildPredicateTargetIdsQuery(anchorFeatureType, clause, knex, systemUserId);
  }

  const clauseQueries = clause.clauses.map((childClause, index) =>
    wrapTargetIdsQuery(
      buildExpressionTargetIdsQuery(anchorFeatureType, childClause, knex, systemUserId, `${aliasPrefix}_${index}`),
      knex,
      `${aliasPrefix}_${index}`
    )
  );
  let baseQuery = clauseQueries[0];

  for (let i = 1; i < clauseQueries.length; i++) {
    if (clause.operator === 'AND') {
      baseQuery = baseQuery.intersect(clauseQueries[i]);
    } else {
      baseQuery = baseQuery.union(clauseQueries[i]);
    }
  }

  return baseQuery;
}

/**
 * Wraps target ID queries before set operations.
 *
 * Predicate clauses carry a `WITH RECURSIVE` CTE (the bounded content-edge walk). PostgreSQL accepts a WITH-bearing
 * query inside a derived table, but not directly as a parenthesized INTERSECT/UNION operand, so the wrap is required.
 */
function wrapTargetIdsQuery(query: Knex.QueryBuilder, knex: Knex, alias: string): Knex.QueryBuilder {
  return knex.select('submission_feature_id').from(query.as(alias));
}

/**
 * Builds a target submission_feature_id query for one typed expression predicate.
 */
function buildPredicateTargetIdsQuery(
  anchorFeatureType: string,
  clause: NormalizedExpressionTreePredicate,
  knex: Knex,
  systemUserId?: number | null
): Knex.QueryBuilder {
  const evidenceQuery = buildPredicateEvidenceIdsQuery(clause, knex, systemUserId);
  return projectEvidenceToTargetIdsQuery(anchorFeatureType, evidenceQuery, knex, systemUserId);
}

/**
 * Builds a submission_feature_id query for features that directly satisfy one typed expression predicate.
 *
 * This query is intentionally target-feature agnostic. It only returns evidence features that directly carry a
 * matching property row. When a user security context is present, inaccessible evidence is removed before graph
 * projection so secured evidence cannot influence visible target results.
 */
function buildPredicateEvidenceIdsQuery(
  clause: NormalizedExpressionTreePredicate,
  knex: Knex,
  systemUserId?: number | null
): Knex.QueryBuilder {
  const predicate = clause.internal_predicate;
  const { tableName, valueColumn } = getPredicateTableConfig(predicate);

  let query = knex(`${tableName} as p`)
    .distinct()
    .select('p.submission_feature_id')
    .join('feature_type_property as ftp', 'ftp.feature_type_property_id', 'p.feature_type_property_id')
    .where('ftp.feature_property_id', clause.feature_property_id)
    .whereNull('ftp.record_end_date');

  if (clause.feature_type_property_id !== null) {
    query = query.where('p.feature_type_property_id', clause.feature_type_property_id);
  }

  if (predicate.type === 'taxon') {
    query = query.join('taxon as t', 't.taxon_id', 'p.taxon_id').whereNull('t.record_end_date');
  }

  if (predicate.type === 'code') {
    query = query
      .join('contributor_codeset_code as csc', 'csc.contributor_codeset_code_id', 'p.contributor_codeset_code_id')
      .join('contributor_codeset as cs', 'cs.contributor_codeset_id', 'csc.contributor_codeset_id')
      .whereNull('csc.record_end_date')
      .whereNull('cs.record_end_date');
  }

  if (predicate.operator === 'NotEquals') {
    query = applyExpressionPredicateNotEquals(query, clause, tableName, valueColumn, knex);
  } else {
    query = applyExpressionPredicateOperator(query, predicate, valueColumn, knex);
  }

  const securityFilter = buildSecurityFilter(knex, systemUserId, 'p.submission_feature_id');

  if (securityFilter) {
    query = query.whereRaw(securityFilter);
  }

  return query;
}

/**
 * Projects evidence feature IDs to the requested target feature type.
 *
 * Relatedness is the union of two reachability sources:
 *   (a) the precomputed `submission_feature_closure` reachability — parent-ancestry plus property-reference, in
 *       BOTH directions; and
 *   (b) a bounded recursive walk over the `submission_feature_feature` content (`data.content`) edges the closure
 *       deliberately omits — excluded from the closure because closing over them would make the closure the
 *       complete O(N^2) same-upload digraph.
 *
 * The walk starts from the evidence features and follows those edges out to MAX_SEARCH_GRAPH_DEPTH hops,
 * cycle-guarded by the visited path. Every content-reached node is then probed against the closure in BOTH
 * directions (forward by source: its ancestors + referenced features; reverse by target: its descendants +
 * referencing features), so a predicate that filters one feature type resolves results deeper or shallower in the
 * hierarchy, and content cross-references chain transitively into the closure reach. A forward-only or one-hop
 * probe would silently drop the common "filter the container, return the contained" search and multi-hop content
 * chains. Because `content_reach` is seeded from the evidence, probing the closure from `content_reach` already
 * covers the closure reach of the evidence features themselves — no separate evidence-to-closure probe is needed.
 *
 * `is_ancestor` is NOT consulted here. That flag marks the authorization (parent-ancestry) subset only; search
 * relatedness uses the full reachability set, so every closure row counts.
 *
 * The three reachability selects are combined with UNION (not UNION ALL) so a feature reachable through more than
 * one path is counted once — a downstream count(*) wrap must not double-count it.
 *
 * The security filter is re-applied to the resolved target rows, not only the evidence. Relatedness can reach a
 * secured target feature from unsecured evidence, which would leak the target id to any consumer that uses this
 * subquery directly (e.g. the download pipeline). Applying it here protects every consumer of this shared
 * subquery — search and download alike — with the same target-level security boundary.
 */
function projectEvidenceToTargetIdsQuery(
  anchorFeatureType: string,
  evidenceQuery: Knex.QueryBuilder,
  knex: Knex,
  systemUserId?: number | null
): Knex.QueryBuilder {
  // reachable set: the content-reached nodes themselves, plus the closure probed in both directions from every
  // content-reached node. Inlined here (not a top-level CTE) because it must reference the content_reach CTE.
  // UNION (not UNION ALL) dedups a feature reachable via more than one path — a count(*) wrap must not double-count.
  const reachable = knex
    .select('content_reach.feature_id as submission_feature_id')
    .from('content_reach')
    .union([
      // closure forward: ancestors + referenced features of every content-reached node
      knex
        .select('c.target_submission_feature_id as submission_feature_id')
        .from('submission_feature_closure as c')
        .join('content_reach as cr', 'cr.feature_id', 'c.source_submission_feature_id'),
      // closure reverse: descendants + referencing features of every content-reached node
      knex
        .select('c.source_submission_feature_id as submission_feature_id')
        .from('submission_feature_closure as c')
        .join('content_reach as cr', 'cr.feature_id', 'c.target_submission_feature_id')
    ]);

  const query = knex
    .queryBuilder()
    .with('evidence', evidenceQuery.clone())
    // edges the closure deliberately omits, walked here: bidirectional content (data.content) edges.
    // The builder is active-guarded.
    .with('content_edges', (qb) => {
      qb.select('from_feature_id', 'to_feature_id').from(buildContentEdgesQuery(knex).as('content_feature_edges'));
    })
    // recursive content walk: from each evidence feature, follow content edges out to MAX_SEARCH_GRAPH_DEPTH hops,
    // cycle-guarded by the visited path. parent/property transitivity is NOT walked here — the closure handles it.
    .withRecursive('content_reach', (qb) => {
      qb.select(
        'evidence.submission_feature_id as feature_id',
        knex.raw('ARRAY[evidence.submission_feature_id] as path'),
        knex.raw('0 as depth')
      )
        .from('evidence')
        .unionAll([
          knex
            .select(
              'content_edges.to_feature_id as feature_id',
              knex.raw('content_reach.path || content_edges.to_feature_id as path'),
              knex.raw('content_reach.depth + 1 as depth')
            )
            .from('content_reach')
            .join('content_edges', 'content_edges.from_feature_id', 'content_reach.feature_id')
            .where('content_reach.depth', '<', MAX_SEARCH_GRAPH_DEPTH)
            .whereRaw('NOT content_edges.to_feature_id = ANY(content_reach.path)')
        ]);
    })
    .distinct()
    .select('sf.submission_feature_id')
    .from(reachable.as('reachable'))
    .join('submission_feature as sf', 'sf.submission_feature_id', 'reachable.submission_feature_id')
    .join('feature_type as ft', 'ft.feature_type_id', 'sf.feature_type_id')
    .where('ft.name', anchorFeatureType)
    .whereNull('sf.record_end_date')
    .whereNull('ft.record_end_date');

  const targetSecurityFilter = buildSecurityFilter(knex, systemUserId, 'sf.submission_feature_id');
  if (targetSecurityFilter) {
    query.whereRaw(targetSecurityFilter);
  }

  return query;
}

/**
 * Builds the bidirectional content (`data.content`) edges that the closure deliberately omits, so the search-time
 * recursion can walk them, emitted as from_feature_id -> to_feature_id.
 *
 * `submission_feature_feature` stores direct content edges only and has no record_end_date column. Active-record
 * filtering is applied to the source and target submission_feature rows instead, because either endpoint may
 * reference a soft-deleted feature.
 */
function buildContentEdgesQuery(knex: Knex): Knex.QueryBuilder {
  const forward = knex('submission_feature_feature as sff')
    .select('sff.source_feature_id as from_feature_id', 'sff.target_feature_id as to_feature_id')
    .join('submission_feature as source_sf', 'source_sf.submission_feature_id', 'sff.source_feature_id')
    .join('submission_feature as target_sf', 'target_sf.submission_feature_id', 'sff.target_feature_id')
    .whereNull('source_sf.record_end_date')
    .whereNull('target_sf.record_end_date');

  const reverse = knex('submission_feature_feature as sff')
    .select('sff.target_feature_id as from_feature_id', 'sff.source_feature_id as to_feature_id')
    .join('submission_feature as source_sf', 'source_sf.submission_feature_id', 'sff.source_feature_id')
    .join('submission_feature as target_sf', 'target_sf.submission_feature_id', 'sff.target_feature_id')
    .whereNull('source_sf.record_end_date')
    .whereNull('target_sf.record_end_date');

  return forward.unionAll([reverse]);
}

/**
 * Resolves the typed property table and value column for an expression predicate.
 */
function getPredicateTableConfig(predicate: InternalTypedPredicate): { tableName: string; valueColumn: string } {
  switch (predicate.type) {
    case 'string':
      return { tableName: 'submission_feature_property_string', valueColumn: 'p.value' };
    case 'number':
      return { tableName: 'submission_feature_property_number', valueColumn: 'p.value' };
    case 'boolean':
      return { tableName: 'submission_feature_property_boolean', valueColumn: 'p.value' };
    case 'timestamp':
      return { tableName: 'submission_feature_property_timestamp', valueColumn: 'p.value' };
    case 'taxon':
      return { tableName: 'submission_feature_property_taxon', valueColumn: 'p.taxon_id' };
    case 'geometry':
      return { tableName: 'submission_feature_property_geometry', valueColumn: 'p.value' };
    case 'code':
      return { tableName: 'submission_feature_property_code', valueColumn: 'p.contributor_codeset_code_id' };
    default: {
      const exhaustivePredicate: never = predicate;
      throw new ApiBuildSQLError('Unsupported expression predicate type', [
        'expression-evaluation->getPredicateTableConfig',
        { predicate: exhaustivePredicate }
      ]);
    }
  }
}

/**
 * Applies feature-level NotEquals semantics for multi-value property rows.
 *
 * Row-level `p.value <> X` is incorrect for multi-value properties because a feature with
 * values [red, blue] would match `NotEquals red` through the blue row. This predicate means
 * the evidence feature has no row for the semantic property equal to the requested value.
 */
function applyExpressionPredicateNotEquals(
  query: Knex.QueryBuilder,
  clause: NormalizedExpressionTreePredicate,
  tableName: string,
  valueColumn: string,
  knex: Knex
): Knex.QueryBuilder {
  const columnName = valueColumn.replace('p.', '');
  const value = getScalarPredicateValue(clause.internal_predicate);

  if (clause.feature_type_property_id !== null) {
    return query.whereNotExists(
      knex(`${tableName} as p_not_equals`)
        .select(knex.raw('1'))
        .whereRaw('p_not_equals.submission_feature_id = p.submission_feature_id')
        .where('p_not_equals.feature_type_property_id', clause.feature_type_property_id)
        .where(`p_not_equals.${columnName}`, value)
    );
  }

  return query.whereNotExists(
    knex(`${tableName} as p_not_equals`)
      .select(knex.raw('1'))
      .join(
        'feature_type_property as ftp_not_equals',
        'ftp_not_equals.feature_type_property_id',
        'p_not_equals.feature_type_property_id'
      )
      .whereRaw('p_not_equals.submission_feature_id = p.submission_feature_id')
      .where('ftp_not_equals.feature_property_id', clause.feature_property_id)
      .where(`p_not_equals.${columnName}`, value)
      .whereNull('ftp_not_equals.record_end_date')
  );
}

/**
 * Get a scalar predicate value for SQL equality comparisons.
 */
function getScalarPredicateValue(predicate: InternalTypedPredicate): string | number | boolean | undefined {
  if (!('value' in predicate)) {
    return undefined;
  }

  if (
    predicate.value === undefined ||
    typeof predicate.value === 'string' ||
    typeof predicate.value === 'number' ||
    typeof predicate.value === 'boolean'
  ) {
    return predicate.value;
  }

  throw new ApiBuildSQLError('Predicate value is not scalar', [
    'expression-evaluation->getScalarPredicateValue',
    { predicate }
  ]);
}

/**
 * Applies a typed expression predicate operator to a property value query.
 */
function applyExpressionPredicateOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTypedPredicate,
  valueColumn: string,
  knex: Knex
): Knex.QueryBuilder {
  if (predicate.operator === 'Exists') {
    return query.whereNotNull(valueColumn);
  }

  switch (predicate.type) {
    case 'string':
      return applyStringExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    case 'number':
      return applyComparableExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    case 'boolean':
      return query.where(valueColumn, predicate.value);
    case 'timestamp':
      return applyTimestampExpressionOperator(query, valueColumn, predicate);
    case 'taxon':
      return applyTaxonExpressionOperator(query, valueColumn, predicate.operator, predicate.value, knex);
    case 'geometry':
      return applyGeometryExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    case 'code':
      return applyComparableExpressionOperator(query, valueColumn, predicate.operator, predicate.value);
    default: {
      const exhaustivePredicate: never = predicate;
      throw new ApiBuildSQLError('Unsupported expression predicate type', [
        'expression-evaluation->applyExpressionPredicateOperator',
        { predicate: exhaustivePredicate }
      ]);
    }
  }
}

/**
 * Applies a string expression operator.
 */
function applyStringExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: string | undefined
): Knex.QueryBuilder {
  switch (operator) {
    case 'Equals':
      return query.where(column, value);
    case 'NotEquals':
      return query.whereNot(column, value);
    case 'Like':
      return query.whereRaw(`${column} LIKE ?`, [value]);
    case 'ILike':
    case 'Contains':
      return query.whereRaw(`${column} ILIKE ?`, [`%${value}%`]);
    case 'StartsWith':
      return query.whereRaw(`${column} ILIKE ?`, [`${value}%`]);
    case 'EndsWith':
      return query.whereRaw(`${column} ILIKE ?`, [`%${value}`]);
    default:
      return query;
  }
}

/**
 * Applies an equality/comparison expression operator.
 */
function applyComparableExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: string | number | boolean | undefined
): Knex.QueryBuilder {
  switch (operator) {
    case 'Equals':
      return query.where(column, value);
    case 'NotEquals':
      return query.whereNot(column, value);
    case 'GreaterThan':
      return query.whereRaw(`${column} > ?`, [value]);
    case 'GreaterThanOrEqual':
      return query.whereRaw(`${column} >= ?`, [value]);
    case 'LessThan':
      return query.whereRaw(`${column} < ?`, [value]);
    case 'LessThanOrEqual':
      return query.whereRaw(`${column} <= ?`, [value]);
    default:
      return query;
  }
}

/**
 * Applies a timestamp expression operator.
 */
function applyTimestampExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  predicate: Extract<InternalTypedPredicate, { type: 'timestamp' }>
): Knex.QueryBuilder {
  if (!predicate.value) {
    return query;
  }

  const value = parseTimestamp(predicate.value);

  if (!value) {
    throw new ApiBuildSQLError('Unsupported timestamp predicate value', [
      'expression-evaluation->applyTimestampExpressionOperator',
      { value: predicate.value }
    ]);
  }

  if (predicate.operator === 'OnDate') {
    return query.whereRaw(`${column} >= ?::date AND ${column} < (?::date + interval '1 day')`, [
      value.date_value,
      value.date_value
    ]);
  }

  if (predicate.operator === 'OnTime') {
    return query.whereRaw(`${column}::time = ?::time`, [value.time_value]);
  }

  const comparator = predicate.operator === 'Before' ? '<' : '>';

  if (value.date_value && value.time_value) {
    return query.whereRaw(`${column} ${comparator} (?::date + ?::time)`, [value.date_value, value.time_value]);
  }

  if (value.date_value) {
    return query.whereRaw(`${column}::date ${comparator} ?::date`, [value.date_value]);
  }

  return query.whereRaw(`${column}::time ${comparator} ?::time`, [value.time_value]);
}

/**
 * Applies a taxon expression operator.
 */
function applyTaxonExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: number | undefined,
  knex: Knex
): Knex.QueryBuilder {
  switch (operator) {
    case 'Equals':
      return query.where(column, value);
    case 'ParentOf':
      return query.whereRaw('EXISTS (?)', [buildTaxonAncestorExistsQuery(knex, value, column, false)]);
    case 'ChildOf':
      return query.whereRaw(
        `NULLIF((SELECT itis_data->>'parentTSN' FROM taxon WHERE taxon_id = ${column}), '')::integer = ` +
          `(SELECT itis_tsn FROM taxon WHERE taxon_id = ?)`,
        [value]
      );
    case 'DescendsFrom':
      return query.whereRaw('EXISTS (?)', [buildTaxonDescendantExistsQuery(knex, value, column)]);
    case 'AscendsFrom':
      return query.whereRaw('EXISTS (?)', [buildTaxonAncestorExistsQuery(knex, value, column, true)]);
    default:
      return query;
  }
}

/**
 * Builds a recursive query checking whether the candidate taxon is an ancestor of the target taxon.
 */
function buildTaxonAncestorExistsQuery(
  knex: Knex,
  targetTaxonId: number | undefined,
  candidateTaxonColumn: string,
  includeAllAncestors: boolean
): Knex.Raw {
  const recursiveLimit = includeAllAncestors ? '' : 'WHERE depth = 1';

  return knex.raw(
    `WITH RECURSIVE ancestors AS (
      SELECT taxon_id, itis_tsn, NULLIF(itis_data->>'parentTSN', '')::integer AS parent_tsn, 0 AS depth
      FROM taxon
      WHERE taxon_id = ?
      UNION ALL
      SELECT parent.taxon_id, parent.itis_tsn, NULLIF(parent.itis_data->>'parentTSN', '')::integer, ancestors.depth + 1
      FROM taxon parent
      JOIN ancestors ON parent.itis_tsn = ancestors.parent_tsn
      WHERE parent.record_end_date IS NULL
    )
    SELECT 1
    FROM ancestors
    WHERE taxon_id = ${candidateTaxonColumn}
    ${recursiveLimit}`,
    [targetTaxonId]
  );
}

/**
 * Builds a recursive query checking whether the candidate taxon descends from the target taxon.
 */
function buildTaxonDescendantExistsQuery(
  knex: Knex,
  targetTaxonId: number | undefined,
  candidateTaxonColumn: string
): Knex.Raw {
  return knex.raw(
    `WITH RECURSIVE ancestors AS (
      SELECT taxon_id, itis_tsn, NULLIF(itis_data->>'parentTSN', '')::integer AS parent_tsn
      FROM taxon
      WHERE taxon_id = ${candidateTaxonColumn}
      UNION ALL
      SELECT parent.taxon_id, parent.itis_tsn, NULLIF(parent.itis_data->>'parentTSN', '')::integer
      FROM taxon parent
      JOIN ancestors ON parent.itis_tsn = ancestors.parent_tsn
      WHERE parent.record_end_date IS NULL
    )
    SELECT 1
    FROM ancestors
    WHERE taxon_id = ?`,
    [targetTaxonId]
  );
}

/**
 * Applies a geometry expression operator.
 *
 * @param {Knex.QueryBuilder} query - The query to apply the operator to.
 * @param {string} column - The geometry column reference (e.g. `p.value`).
 * @param {InternalTypedPredicate['operator']} operator - The geometry operator (`Within`, `Intersects`, `Contains`).
 * @param {unknown} value - GeoJSON geometry value to compare against.
 * @return {Knex.QueryBuilder} The query with the geometry predicate applied.
 */
function applyGeometryExpressionOperator(
  query: Knex.QueryBuilder,
  column: string,
  operator: InternalTypedPredicate['operator'],
  value: unknown
): Knex.QueryBuilder {
  const geometry = 'public.ST_Force2D(public.ST_GeomFromGeoJSON(?))';
  const geoJson = JSON.stringify(value);

  switch (operator) {
    case 'Within':
      return query.whereRaw(`public.ST_Within(${column}, ${geometry})`, [geoJson]);
    case 'Intersects':
      return query.whereRaw(`public.ST_Intersects(${column}, ${geometry})`, [geoJson]);
    case 'Contains':
      return query.whereRaw(`public.ST_Contains(${column}, ${geometry})`, [geoJson]);
    default:
      return query;
  }
}

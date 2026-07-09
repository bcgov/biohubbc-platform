import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { ApiBuildSQLError } from '../errors/api-error';
import { InternalTypedPredicate, TimestampInternalPredicate } from '../models/expression-predicate';
import {
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreeExpression,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import { buildSecurityFilter, isSubmissionFeatureActive } from './sql-fragments';

/**
 * Pure SQL builders that compile a normalized expression tree into Knex
 * subqueries returning matching submission_feature_id values for an anchor
 * feature type.
 *
 * Each predicate first resolves direct evidence features from typed property
 * rows, then projects candidate anchor features against that evidence. Same-type
 * evidence must be the anchor row itself; different-type evidence may be
 * connected through the precomputed `submission_feature_closure` table in either
 * direction. The projection does not recursively walk content edges.
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
    .whereRaw(isSubmissionFeatureActive('sf'));

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
  // systemUserId omitted → buildSecurityFilter returns null at every layer → no access filtering.
  return buildExpressionTargetIdsQuery(anchorFeatureType, normalizedExpression, knex);
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
 *
 * @param {string} anchorFeatureType - Feature type name that result IDs must belong to.
 * @param {NormalizedExpressionTreeClause} clause - Normalized predicate or expression clause to compile.
 * @param {Knex} knex - Knex instance used to build the subquery.
 * @param {number | null} [systemUserId] - Security context (null = anonymous).
 * @param {string} [aliasPrefix='expression_clause'] - Alias prefix for nested set-operation operands.
 * @return {Knex.QueryBuilder} Unexecuted subquery returning target submission_feature_id rows.
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
 * Predicate clauses carry a WITH-bearing evidence CTE. PostgreSQL accepts a WITH-bearing
 * query inside a derived table, but not directly as a parenthesized INTERSECT/UNION operand, so the wrap is required.
 *
 * @param {Knex.QueryBuilder} query - Target ID query to wrap as a derived table.
 * @param {Knex} knex - Knex instance used to build the wrapper query.
 * @param {string} alias - Derived table alias.
 * @return {Knex.QueryBuilder} Wrapped query selecting submission_feature_id.
 */
function wrapTargetIdsQuery(query: Knex.QueryBuilder, knex: Knex, alias: string): Knex.QueryBuilder {
  return knex.select('submission_feature_id').from(query.as(alias));
}

/**
 * Builds a target submission_feature_id query for one typed expression predicate.
 *
 * The predicate is evaluated in two steps:
 *
 * 1. Build the evidence set: features that directly carry a typed property row
 *    matching the predicate.
 * 2. Project that evidence set back to matching features of `anchorFeatureType`.
 *
 * `projectEvidenceToTargetIdsQuery` owns the anchor-projection semantics:
 *
 * - same feature type evidence must match the anchor row directly;
 * - different feature type evidence may match an anchor row through
 *   `submission_feature_closure` in either direction.
 *
 * This keeps `buildPredicateTargetIdsQuery` small and prevents predicate evaluation
 * from becoming broad graph expansion.
 *
 * @param {string} anchorFeatureType - The route/result feature type to return.
 * @param {NormalizedExpressionTreePredicate} clause - Normalized predicate clause to compile.
 * @param {Knex} knex - Knex instance used to build the SQL query.
 * @param {number | null} [systemUserId] - Security context. `null` represents anonymous access.
 * @return {Knex.QueryBuilder} Unexecuted query returning matching anchor `submission_feature_id` rows.
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
 *
 * @param {NormalizedExpressionTreePredicate} clause - Normalized predicate clause to compile.
 * @param {Knex} knex - Knex instance used to build the evidence query.
 * @param {number | null} [systemUserId] - Security context (null = anonymous).
 * @return {Knex.QueryBuilder} Unexecuted query returning evidence submission_feature_id rows.
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
    .join('submission_feature as sf', 'sf.submission_feature_id', 'p.submission_feature_id')
    .join('feature_type_property as ftp', 'ftp.feature_type_property_id', 'p.feature_type_property_id')
    .where('ftp.feature_property_id', clause.feature_property_id)
    .whereRaw(isSubmissionFeatureActive('sf'))
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
 * Projects predicate evidence feature IDs to matching anchor feature IDs.
 *
 * A predicate is first evaluated directly against typed property rows, producing
 * an `evidence` set: features that directly carry a property matching the predicate.
 *
 * This function returns only features of `anchorFeatureType`.
 *
 * Projection semantics:
 *
 * - If an evidence feature has the same feature type as the anchor, the anchor
 *   must be the evidence feature itself. This handles direct filters such as
 *   `telemetry.elevation < 66` and prevents sibling leakage through a shared
 *   dataset or parent.
 *
 * - If an evidence feature has a different feature type than the anchor, an
 *   anchor matches when it is connected to the evidence feature through
 *   `submission_feature_closure` in either direction. This supports searches
 *   like `telemetry where animal.species = caribou` and
 *   `telemetry where dataset.species = caribou`.
 *
 * This is a candidate-anchor semi-join, not broad evidence graph expansion.
 * Do not walk `submission_feature_feature` content edges here and do not expand
 * from evidence outward before filtering back to the anchor type, because that
 * can pull in non-matching sibling anchors.
 *
 * @param {string} anchorFeatureType - The route/result feature type to return.
 * @param {Knex.QueryBuilder} evidenceQuery - Query returning direct predicate evidence `submission_feature_id` rows.
 * @param {Knex} knex - Knex instance used to build the SQL query.
 * @param {number | null} [systemUserId] - Security context. `null` represents anonymous access.
 * @return {Knex.QueryBuilder} Unexecuted query returning matching anchor `submission_feature_id` rows.
 */
function projectEvidenceToTargetIdsQuery(
  anchorFeatureType: string,
  evidenceQuery: Knex.QueryBuilder,
  knex: Knex,
  systemUserId?: number | null
): Knex.QueryBuilder {
  const query = knex
    .queryBuilder()
    .with('evidence', evidenceQuery.clone())
    .select('anchor_sf.submission_feature_id')
    .from('submission_feature as anchor_sf')
    .join('feature_type as anchor_ft', 'anchor_ft.feature_type_id', 'anchor_sf.feature_type_id')
    .where('anchor_ft.name', anchorFeatureType)
    .whereRaw(isSubmissionFeatureActive('anchor_sf'))
    .whereNull('anchor_ft.record_end_date')
    .whereExists(
      knex
        .select(knex.raw('1'))
        .from('evidence')
        .join(
          'submission_feature as evidence_sf',
          'evidence_sf.submission_feature_id',
          'evidence.submission_feature_id'
        )
        .join('feature_type as evidence_ft', 'evidence_ft.feature_type_id', 'evidence_sf.feature_type_id')
        .whereRaw(isSubmissionFeatureActive('evidence_sf'))
        .whereNull('evidence_ft.record_end_date')
        .where((qb) => {
          qb.where((sameType) => {
            sameType
              .whereRaw('evidence_ft.name = anchor_ft.name')
              .whereRaw('evidence_sf.submission_feature_id = anchor_sf.submission_feature_id');
          }).orWhere((differentType) => {
            differentType.whereRaw('evidence_ft.name <> anchor_ft.name').where((connected) => {
              connected
                .whereExists(
                  knex
                    .select(knex.raw('1'))
                    .from('submission_feature_closure as c_forward')
                    .whereRaw('c_forward.source_submission_feature_id = anchor_sf.submission_feature_id')
                    .whereRaw('c_forward.target_submission_feature_id = evidence_sf.submission_feature_id')
                )
                .orWhereExists(
                  knex
                    .select(knex.raw('1'))
                    .from('submission_feature_closure as c_reverse')
                    .whereRaw('c_reverse.source_submission_feature_id = evidence_sf.submission_feature_id')
                    .whereRaw('c_reverse.target_submission_feature_id = anchor_sf.submission_feature_id')
                );
            });
          });
        })
    );

  const targetSecurityFilter = buildSecurityFilter(knex, systemUserId, 'anchor_sf.submission_feature_id');
  if (targetSecurityFilter) {
    query.whereRaw(targetSecurityFilter);
  }

  return query;
}

/**
 * Resolves the typed property table and value column for an expression predicate.
 *
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @return {{ tableName: string; valueColumn: string }} Physical property table and value column configuration.
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
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {NormalizedExpressionTreePredicate} clause - Normalized NotEquals predicate clause.
 * @param {string} tableName - Typed property table containing candidate value rows.
 * @param {string} valueColumn - Candidate value column reference prefixed with the `p` alias.
 * @param {Knex} knex - Knex instance used to build the anti-match subquery.
 * @return {Knex.QueryBuilder} Evidence query with feature-level NotEquals semantics applied.
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
 *
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @return {string | number | boolean | undefined} Scalar value suitable for single-column comparisons.
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
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @param {string} valueColumn - Typed property value column reference.
 * @param {Knex} knex - Knex instance used by predicate helpers that need raw subqueries.
 * @return {Knex.QueryBuilder} Evidence query with the predicate operator applied.
 */
function applyExpressionPredicateOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTypedPredicate,
  valueColumn: string,
  knex: Knex
): Knex.QueryBuilder {
  if (predicate.type === 'timestamp') {
    return applyTimestampExpressionOperator(query, predicate);
  }

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
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {string} column - String value column reference.
 * @param {InternalTypedPredicate['operator']} operator - String predicate operator.
 * @param {string | undefined} value - String comparison value.
 * @return {Knex.QueryBuilder} Evidence query with the string operator applied.
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
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {string} column - Comparable value column reference.
 * @param {InternalTypedPredicate['operator']} operator - Comparable predicate operator.
 * @param {string | number | boolean | undefined} value - Comparison value.
 * @return {Knex.QueryBuilder} Evidence query with the comparable operator applied.
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
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {TimestampInternalPredicate} predicate - Normalized timestamp predicate payload.
 * @return {Knex.QueryBuilder} Evidence query with the timestamp operator applied.
 */
function applyTimestampExpressionOperator(
  query: Knex.QueryBuilder,
  predicate: TimestampInternalPredicate
): Knex.QueryBuilder {
  const columns = { date: 'p.date_value', time: 'p.time_value' };

  switch (predicate.operator) {
    case 'Exists':
      return query.whereRaw(`(${columns.date} IS NOT NULL OR ${columns.time} IS NOT NULL)`);
    case 'OnDate':
      if (!predicate.value?.date_value) {
        throw new ApiBuildSQLError('OnDate timestamp predicate requires a date value', [
          'expression-evaluation->applyTimestampExpressionOperator',
          { predicate }
        ]);
      }

      return query.whereRaw(`${columns.date} = ?::date`, [predicate.value.date_value]);
    case 'OnTime':
      if (!predicate.value?.time_value) {
        throw new ApiBuildSQLError('OnTime timestamp predicate requires a time value', [
          'expression-evaluation->applyTimestampExpressionOperator',
          { predicate }
        ]);
      }

      return query.whereRaw(`${columns.time} = ?::time`, [predicate.value.time_value]);
    case 'Before':
    case 'After':
      return applyTimestampComparisonOperator(query, predicate, predicate.operator, columns);
    default:
      throw new ApiBuildSQLError('Unsupported timestamp predicate operator', [
        'expression-evaluation->applyTimestampExpressionOperator',
        { operator: predicate.operator }
      ]);
  }
}

/**
 * Applies Before/After comparisons using the timestamp component(s) present in the predicate value.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {TimestampInternalPredicate} predicate - Normalized timestamp predicate payload.
 * @param {'Before' | 'After'} operator - Timestamp comparison operator.
 * @param {{ date: string; time: string }} columns - Timestamp date/time column references.
 * @return {Knex.QueryBuilder} Evidence query with the timestamp comparison applied.
 */
function applyTimestampComparisonOperator(
  query: Knex.QueryBuilder,
  predicate: TimestampInternalPredicate,
  operator: 'Before' | 'After',
  columns: { date: string; time: string }
): Knex.QueryBuilder {
  if (!predicate.value) {
    throw new ApiBuildSQLError('Timestamp predicate requires a value', [
      'expression-evaluation->applyTimestampComparisonOperator',
      { predicate }
    ]);
  }

  const value = predicate.value;
  const comparator = operator === 'Before' ? '<' : '>';
  const hasDate = Boolean(value.date_value);
  const hasTime = Boolean(value.time_value);

  if (hasDate && hasTime) {
    return query.whereRaw(`(${columns.date} + ${columns.time}) ${comparator} (?::date + ?::time)`, [
      value.date_value,
      value.time_value
    ]);
  }

  if (hasDate) {
    return query.whereRaw(`${columns.date} ${comparator} ?::date`, [value.date_value]);
  }

  if (!hasTime) {
    throw new ApiBuildSQLError('Timestamp comparison predicate requires a date or time value', [
      'expression-evaluation->applyTimestampComparisonOperator',
      { predicate }
    ]);
  }

  return query.whereRaw(`${columns.time} ${comparator} ?::time`, [value.time_value]);
}

/**
 * Applies a taxon expression operator.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {string} column - Taxon id column reference.
 * @param {InternalTypedPredicate['operator']} operator - Taxon predicate operator.
 * @param {number | undefined} value - Target taxon id.
 * @param {Knex} knex - Knex instance used to build recursive taxon subqueries.
 * @return {Knex.QueryBuilder} Evidence query with the taxon operator applied.
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
 *
 * @param {Knex} knex - Knex instance used to build the raw recursive query.
 * @param {number | undefined} targetTaxonId - Target taxon id supplied by the predicate.
 * @param {string} candidateTaxonColumn - Candidate taxon column reference from the evidence row.
 * @param {boolean} includeAllAncestors - Whether to include all ancestors instead of only the direct parent.
 * @return {Knex.Raw} Raw EXISTS subquery for ancestor matching.
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
 *
 * @param {Knex} knex - Knex instance used to build the raw recursive query.
 * @param {number | undefined} targetTaxonId - Target ancestor taxon id supplied by the predicate.
 * @param {string} candidateTaxonColumn - Candidate taxon column reference from the evidence row.
 * @return {Knex.Raw} Raw EXISTS subquery for descendant matching.
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

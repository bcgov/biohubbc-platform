import { Knex } from 'knex';
import { ApiBuildSQLError } from '../errors/api-error';
import { InternalTimestampPredicate, InternalTypedPredicate } from '../models/expression-predicate';
import { NormalizedExpressionTreeClause, NormalizedExpressionTreePredicate } from '../models/expression-tree-internal';
import type { LogicalOperator } from '../models/logical-operator';

/**
 * Resolves active concrete feature-type-property ids for one semantic property.
 *
 * @example
 * A predicate with `feature_property_id = 14` and `feature_type_property_id = null` returns every active assignment of
 * property 14. Supplying assignment 108 adds that exact assignment constraint and returns at most 108.
 *
 * @param {NormalizedExpressionTreePredicate} property - Predicate containing the resolved property identity.
 * @param {Knex} knex - Knex instance used to build the metadata query.
 * @return {Knex.QueryBuilder} Query returning concrete feature_type_property_id rows.
 */
export function buildPredicateFeatureTypePropertyIdsQuery(
  property: NormalizedExpressionTreePredicate,
  knex: Knex
): Knex.QueryBuilder {
  const query = knex('feature_type_property as ftp')
    .select('ftp.feature_type_property_id')
    .where('ftp.feature_property_id', property.feature_property_id)
    .whereNull('ftp.record_end_date');

  if (property.feature_type_property_id !== null) {
    query.where('ftp.feature_type_property_id', property.feature_type_property_id);
  }

  return query;
}

/**
 * Returns the predicates that must be applied to the same typed-property row.
 *
 * @example
 * A predicate returns `[predicate]`. A compatible `AND(Count > 7, Count < 9)` expression returns both contained bounds.
 * General mixed expressions never reach this helper because `hasCompatiblePredicates` rejects them first.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate evidence representation.
 * @return {NormalizedExpressionTreePredicate[]} Predicates represented by the evidence.
 */
export function getEvidencePredicates(evidence: NormalizedExpressionTreeClause): NormalizedExpressionTreePredicate[] {
  return evidence.type === 'predicate' ? [evidence] : evidence.clauses.filter((clause) => clause.type === 'predicate');
}

/**
 * Determines whether evidence is an AND expression of same-property equality predicates.
 *
 * @example
 * `AND(Count = 77, Count = 100)` returns true. `OR(Count = 77, Count = 100)`, a numeric range, and a single predicate
 * each return false.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate evidence representation.
 * @return {boolean} True when every predicate in an AND expression is an equality.
 */
export function isAndEqualityExpression(evidence: NormalizedExpressionTreeClause): boolean {
  return (
    evidence.type === 'expression' &&
    evidence.operator === 'AND' &&
    evidence.clauses.every((clause) => clause.type === 'predicate' && clause.operator === 'Equals')
  );
}

/**
 * Applies predicates that share one typed-property-row query.
 *
 * @example
 * `AND(Count > 7, Count < 9)` appends both comparisons to the same `p` row. `OR(Count = 77, Count = 100)` appends one
 * `p.value IN (100, 77)` filter. The OR pathway is only called for compatible equality groups.
 *
 * @param {Knex.QueryBuilder} query - Query containing the shared `p` property-row alias.
 * @param {NormalizedExpressionTreePredicate[]} predicates - Predicates applied to that row.
 * @param {Knex} knex - Knex instance used by predicate helpers.
 * @param {LogicalOperator} operator - Logical operator joining the predicates.
 * @return {Knex.QueryBuilder} Query constrained by the combined predicates.
 */
export function applyEvidenceFilters(
  query: Knex.QueryBuilder,
  predicates: NormalizedExpressionTreePredicate[],
  knex: Knex,
  operator: LogicalOperator
): Knex.QueryBuilder {
  if (operator === 'OR') {
    const predicate = predicates[0].internal_predicate;
    const { valueColumn } = getPredicateTableConfig(predicate);
    return applyPropertyReferenceLifecycleFilters(query, predicate).whereIn(
      valueColumn,
      getScalarPredicateValues(predicates)
    );
  }

  return predicates.reduce((filteredQuery, predicate) => applyPredicateFilters(filteredQuery, predicate, knex), query);
}

/**
 * Adds value and reference-lifecycle filters shared by each evidence direction.
 *
 * @param {Knex.QueryBuilder} query - Query containing the `p` alias.
 * @param {NormalizedExpressionTreePredicate} predicate - Predicate to apply.
 * @param {Knex} knex - Knex instance used by predicate helpers.
 * @return {Knex.QueryBuilder} Filtered evidence query.
 */
function applyPredicateFilters(
  query: Knex.QueryBuilder,
  predicate: NormalizedExpressionTreePredicate,
  knex: Knex
): Knex.QueryBuilder {
  const { tableName, valueColumn } = getPredicateTableConfig(predicate.internal_predicate);
  query = applyPropertyReferenceLifecycleFilters(query, predicate.internal_predicate);

  return predicate.operator === 'NotEquals'
    ? applyExpressionPredicateNotEquals(query, predicate, tableName, valueColumn, knex)
    : applyExpressionPredicateOperator(query, predicate.internal_predicate, valueColumn, knex);
}

/**
 * Applies lifecycle joins required by property values backed by reference tables.
 *
 * @param {Knex.QueryBuilder} query - Query containing the shared `p` property-row alias.
 * @param {InternalTypedPredicate} predicate - Typed predicate identifying the property table.
 * @return {Knex.QueryBuilder} Query constrained to active referenced values.
 */
export function applyPropertyReferenceLifecycleFilters(
  query: Knex.QueryBuilder,
  predicate: InternalTypedPredicate
): Knex.QueryBuilder {
  if (predicate.type === 'taxon') {
    return query.join('taxon as t', 't.taxon_id', 'p.taxon_id').whereNull('t.record_end_date');
  }

  if (predicate.type === 'code') {
    return query
      .join('contributor_codeset_code as csc', 'csc.contributor_codeset_code_id', 'p.contributor_codeset_code_id')
      .join('contributor_codeset as cs', 'cs.contributor_codeset_id', 'csc.contributor_codeset_id')
      .whereNull('csc.record_end_date')
      .whereNull('cs.record_end_date');
  }

  return query;
}

/**
 * Resolves the typed property table and value column for an expression predicate.
 *
 * @param {InternalTypedPredicate} predicate - Normalized predicate payload.
 * @return {{ tableName: string; valueColumn: string }} Physical property table and value column configuration.
 */
export function getPredicateTableConfig(predicate: InternalTypedPredicate): { tableName: string; valueColumn: string } {
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
        'expression-predicate-sql->getPredicateTableConfig',
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
    'expression-predicate-sql->getScalarPredicateValue',
    { predicate }
  ]);
}

/**
 * Extracts defined scalar values from equality predicates in an optimized expression.
 *
 * @param {NormalizedExpressionTreePredicate[]} predicates - Predicates requiring scalar values.
 * @return {(string | number | boolean)[]} Defined values suitable for SQL IN and aggregation.
 */
export function getScalarPredicateValues(
  predicates: readonly NormalizedExpressionTreePredicate[]
): (string | number | boolean)[] {
  return predicates.map((predicate) => {
    const value = getScalarPredicateValue(predicate.internal_predicate);
    if (value === undefined) {
      throw new ApiBuildSQLError('Optimized equality predicate requires a scalar value', [
        'expression-predicate-sql->getScalarPredicateValues',
        { predicate }
      ]);
    }

    return value;
  });
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
        'expression-predicate-sql->applyExpressionPredicateOperator',
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
 * @param {InternalTimestampPredicate} predicate - Normalized timestamp predicate payload.
 * @return {Knex.QueryBuilder} Evidence query with the timestamp operator applied.
 */
function applyTimestampExpressionOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTimestampPredicate
): Knex.QueryBuilder {
  const columns = { date: 'p.date_value', time: 'p.time_value' };

  switch (predicate.operator) {
    case 'Exists':
      return query.whereRaw(`(${columns.date} IS NOT NULL OR ${columns.time} IS NOT NULL)`);
    case 'OnDate':
      if (!predicate.value?.date_value) {
        throw new ApiBuildSQLError('OnDate timestamp predicate requires a date value', [
          'expression-predicate-sql->applyTimestampExpressionOperator',
          { predicate }
        ]);
      }

      return query.whereRaw(`${columns.date} = ?::date`, [predicate.value.date_value]);
    case 'OnTime':
      if (!predicate.value?.time_value) {
        throw new ApiBuildSQLError('OnTime timestamp predicate requires a time value', [
          'expression-predicate-sql->applyTimestampExpressionOperator',
          { predicate }
        ]);
      }

      return query.whereRaw(`${columns.time} = ?::time`, [predicate.value.time_value]);
    case 'Before':
    case 'After':
      return applyTimestampComparisonOperator(query, predicate, predicate.operator, columns);
    default:
      throw new ApiBuildSQLError('Unsupported timestamp predicate operator', [
        'expression-predicate-sql->applyTimestampExpressionOperator',
        { operator: predicate.operator }
      ]);
  }
}

/**
 * Applies Before/After comparisons using the timestamp component(s) present in the predicate value.
 *
 * @param {Knex.QueryBuilder} query - Evidence query to constrain.
 * @param {InternalTimestampPredicate} predicate - Normalized timestamp predicate payload.
 * @param {'Before' | 'After'} operator - Timestamp comparison operator.
 * @param {{ date: string; time: string }} columns - Timestamp date/time column references.
 * @return {Knex.QueryBuilder} Evidence query with the timestamp comparison applied.
 */
function applyTimestampComparisonOperator(
  query: Knex.QueryBuilder,
  predicate: InternalTimestampPredicate,
  operator: 'Before' | 'After',
  columns: { date: string; time: string }
): Knex.QueryBuilder {
  if (!predicate.value) {
    throw new ApiBuildSQLError('Timestamp predicate requires a value', [
      'expression-predicate-sql->applyTimestampComparisonOperator',
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
      'expression-predicate-sql->applyTimestampComparisonOperator',
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
 *
 * Exported so the parent-child hierarchy operators can be exercised directly against a real database
 * in integration tests (they walk the `taxon.parent_taxon_id` self-reference via recursive CTEs).
 */
export function applyTaxonExpressionOperator(
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
      return query.whereRaw(`(SELECT parent_taxon_id FROM taxon WHERE taxon_id = ${column}) = ?`, [value]);
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
  const recursiveLimit = includeAllAncestors ? '' : 'AND depth = 1';

  return knex.raw(
    `WITH RECURSIVE ancestors AS (
      SELECT taxon_id, parent_taxon_id, 0 AS depth
      FROM taxon
      WHERE taxon_id = ?
      UNION ALL
      SELECT parent.taxon_id, parent.parent_taxon_id, ancestors.depth + 1
      FROM taxon parent
      JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
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
      SELECT taxon_id, parent_taxon_id
      FROM taxon
      WHERE taxon_id = ${candidateTaxonColumn}
      UNION ALL
      SELECT parent.taxon_id, parent.parent_taxon_id
      FROM taxon parent
      JOIN ancestors ON parent.taxon_id = ancestors.parent_taxon_id
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

import type { Knex } from 'knex';
import { getKnex } from '../database/db';
import {
  NormalizedExpressionTree,
  NormalizedExpressionTreeClause,
  NormalizedExpressionTreePredicate
} from '../models/expression-tree-internal';
import type { LogicalOperator } from '../models/logical-operator';
import type { SearchFeatureQueryOptions } from '../models/search-feature-pagination';
import { hasCompatiblePredicates } from '../utils/expression-optimization';
import {
  applyEvidenceFilters,
  applyPredicateAssignmentFilter,
  buildPredicateAssignmentFeatureTypeIdsQuery,
  getEvidencePredicates,
  getPredicateTableConfig,
  getScalarPredicateValues,
  isAndEqualityExpression
} from './expression-predicate-sql';
import { applySearchQueryOptions } from './search-feature-pagination-sql';

/** The submission and upload whose current features an expression is evaluated over. */
interface SubmissionUploadScope {
  submissionId: number;
  submissionUploadId: string;
}

/**
 * Columns of the recursive walks. `evidence_feature_type_id` is the type of the feature that carried the matching value,
 * and `matched_value` carries that value for AND-equality groups (NULL otherwise).
 */
const UPLOAD_ANCESTOR_COLUMNS = [
  'submission_feature_id',
  'parent_submission_feature_id',
  'feature_type_id',
  'evidence_feature_type_id',
  'matched_value'
];
const UPLOAD_DESCENDANT_COLUMNS = [
  'submission_feature_id',
  'feature_type_id',
  'evidence_feature_type_id',
  'matched_value'
];

/**
 * Build upload-review candidates independently of published closure and public access filters.
 *
 * Like published evidence closure, expression matching follows transitive combinations of parent and feature-reference
 * edges, with both endpoints inside this upload; security inheritance is computed separately using parent edges only.
 * Each predicate is evaluated from its evidence: the upload features holding a matching value, then the features those
 * reach and the features that reach them. The cost is therefore proportional to the evidence and what it reaches rather
 * than to the upload's size, and a page request evaluates the complete match set before ordering and limiting it.
 *
 * @param {number} submissionId Submission boundary.
 * @param {string} submissionUploadId Reviewed upload boundary.
 * @param {NormalizedExpressionTree} [expression] Normalized expression criteria.
 * @param {SearchFeatureQueryOptions} [options] Cursor ordering and page limit.
 * @returns {Knex.QueryBuilder} Unique upload feature IDs (alias `anchor_sf`) matching the expression.
 */
export function buildSubmissionUploadFeatureIdsSubquery(
  submissionId: number,
  submissionUploadId: string,
  expression?: NormalizedExpressionTree,
  options?: SearchFeatureQueryOptions
): Knex.QueryBuilder {
  const knex = getKnex();
  const scope: SubmissionUploadScope = { submissionId, submissionUploadId };
  const query = expression
    ? buildUploadMatchedAnchorsQuery(buildUploadClauseMatchIdsQuery(expression, scope, knex), scope, knex)
    : knex('submission_feature as anchor_sf')
        .select('anchor_sf.submission_feature_id')
        .whereRaw(buildUploadScopeCondition('anchor_sf', scope, knex));

  // Active feature types are collected once, so the filter applies to each anchor row rather than joining a type.
  query.whereRaw('anchor_sf.feature_type_id = ANY(ARRAY(?))', [
    knex('feature_type').select('feature_type_id').whereNull('record_end_date')
  ]);

  applySearchQueryOptions(query, 'anchor_sf', options);
  return query;
}

/**
 * Builds the upload boundary for one `submission_feature` alias: the feature belongs to the submission and upload and is
 * current. Every feature an evaluation reads, whether evidence, walked relative or anchor, must satisfy it, which keeps
 * parent and reference edges that leave the upload out of the graph.
 *
 * @param {string} alias Alias exposing `submission_id`, `submission_upload_id` and `record_end_date`.
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the condition.
 * @returns {Knex.Raw} Boolean SQL condition.
 */
function buildUploadScopeCondition(alias: string, scope: SubmissionUploadScope, knex: Knex): Knex.Raw {
  return knex.raw('??.submission_id = ? AND ??.submission_upload_id = ? AND ??.record_end_date IS NULL', [
    alias,
    scope.submissionId,
    alias,
    scope.submissionUploadId,
    alias
  ]);
}

/**
 * Recursively builds the unique IDs of upload features matching one expression clause.
 *
 * Predicates and compatible predicate groups are evaluated from their evidence. Other expressions combine complete
 * child sets with SQL intersection or union according to their logical operator. Combining sets rather than testing
 * membership per feature keeps every clause a single pass, whatever the size of its children.
 *
 * @example
 * `AND(Count > 7, Name = 'elk')` intersects the independently resolved Count and Name sets.
 * `OR(Name = 'elk', Name = 'deer')` is compatible and instead builds one evidence query with an `IN` filter.
 *
 * @param {NormalizedExpressionTreeClause} clause Predicate or expression to evaluate.
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query returning unique matching `submission_feature_id` values.
 */
function buildUploadClauseMatchIdsQuery(
  clause: NormalizedExpressionTreeClause,
  scope: SubmissionUploadScope,
  knex: Knex
): Knex.QueryBuilder {
  if (clause.type === 'predicate') {
    return buildUploadEvidenceMatchIdsQuery(clause, scope, knex);
  }

  if (hasCompatiblePredicates(clause)) {
    return isAndEqualityExpression(clause)
      ? buildUploadAndEqualityMatchIdsQuery(clause, scope, knex)
      : buildUploadEvidenceMatchIdsQuery(clause, scope, knex);
  }

  if (clause.clauses.length === 1) {
    return buildUploadClauseMatchIdsQuery(clause.clauses[0], scope, knex);
  }

  const [firstClause, ...remainingClauses] = clause.clauses.map((childClause, index) => {
    const alias = `upload_clause_${index}`;

    return knex
      .from(buildUploadClauseMatchIdsQuery(childClause, scope, knex).as(alias))
      .select(`${alias}.submission_feature_id`);
  });

  return clause.operator === 'AND'
    ? firstClause.intersect(remainingClauses, true)
    : firstClause.union(remainingClauses, true);
}

/**
 * Builds the upload features matching one predicate or compatible same-property group.
 *
 * A feature matches when it carries a matching value itself, or when a feature of another type that carries one is
 * related to it: an ancestor or referenced feature it reaches, or a descendant or referring feature that reaches it.
 * Evidence on the feature itself needs no type check: a value is only stored under an assignment of its own feature's
 * type, so the carrying feature's type is the assignment's type.
 *
 * @example
 * For `Species = owl` on deployments, an owl deployment matches directly, its telemetry points match as descendants that
 * reach it, and its survey matches as an ancestor it reaches. A second deployment is not related through any walk, so
 * it only matches with its own owl value.
 *
 * @param {NormalizedExpressionTreeClause} evidence Predicate or compatible same-property expression.
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query returning unique matching `submission_feature_id` values.
 */
function buildUploadEvidenceMatchIdsQuery(
  evidence: NormalizedExpressionTreeClause,
  scope: SubmissionUploadScope,
  knex: Knex
): Knex.QueryBuilder {
  const predicates = getEvidencePredicates(evidence);
  const operator = evidence.type === 'expression' ? evidence.operator : 'AND';
  const related = buildUploadRelatedFeaturesQuery(knex).clearSelect().select('upload_related.submission_feature_id');

  return withUploadRelationships(buildUploadEvidenceQuery(predicates, operator, false, scope, knex), scope, knex)
    .select('upload_evidence.submission_feature_id')
    .from('upload_evidence')
    .union(related, true);
}

/**
 * Builds the upload features matching an AND of same-property equalities, each requested value being present on the
 * feature or on a related feature of another type.
 *
 * Values are mapped to the feature they match before aggregation, so distinct evidence rows and distinct related
 * features may jointly satisfy the expression.
 *
 * @example
 * For `Count = 77 AND Count = 100`, a feature with values `[77, 100]` matches, as does a feature related to two others
 * contributing 77 and 100 separately. A feature reaching only 77 does not match.
 *
 * @param {NormalizedExpressionTree} expression AND expression containing same-property equality predicates.
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query returning features that matched every requested value.
 */
function buildUploadAndEqualityMatchIdsQuery(
  expression: NormalizedExpressionTree,
  scope: SubmissionUploadScope,
  knex: Knex
): Knex.QueryBuilder {
  const predicates = getEvidencePredicates(expression);
  const values = getScalarPredicateValues(predicates);
  const mappedValues = knex
    .select('upload_evidence.submission_feature_id', 'upload_evidence.matched_value')
    .from('upload_evidence')
    .unionAll(buildUploadRelatedFeaturesQuery(knex), true);

  return withUploadRelationships(buildUploadEvidenceQuery(predicates, 'OR', true, scope, knex), scope, knex)
    .select('upload_grouped_evidence.submission_feature_id')
    .from(mappedValues.as('upload_grouped_evidence'))
    .groupBy('upload_grouped_evidence.submission_feature_id')
    .havingRaw('count(DISTINCT upload_grouped_evidence.matched_value) = ?', [values.length]);
}

/**
 * Builds the evidence for one predicate or compatible group: the current upload features carrying a matching value.
 *
 * Candidates are limited to the feature types holding the property's assignments, the only types that can carry its
 * values, collected once so the filter applies as the upload's features are read; each candidate is then probed for a
 * matching value. The probe is a lateral subquery keyed on the feature, so it reads that feature's property rows through
 * an index whatever the statistics say about the upload, and the evidence costs at most one probe per candidate feature.
 *
 * @param {NormalizedExpressionTreePredicate[]} predicates Predicates applied to one property row.
 * @param {LogicalOperator} operator Operator joining the predicates on that row.
 * @param {boolean} includeMatchedValue True to return one row per distinct matched value (AND-equality groups).
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query returning the evidence feature, its parent, its type and the matched value.
 */
function buildUploadEvidenceQuery(
  predicates: NormalizedExpressionTreePredicate[],
  operator: LogicalOperator,
  includeMatchedValue: boolean,
  scope: SubmissionUploadScope,
  knex: Knex
): Knex.QueryBuilder {
  const property = predicates[0];
  const { tableName, valueColumn } = getPredicateTableConfig(property.internal_predicate);
  const propertyRows = applyEvidenceFilters(
    applyPredicateAssignmentFilter(
      knex(`${tableName} as p`).whereRaw('p.submission_feature_id = evidence_sf.submission_feature_id'),
      property,
      knex
    ),
    predicates,
    knex,
    operator
  );
  const matchedValues = includeMatchedValue
    ? propertyRows.distinct({ matched_value: valueColumn })
    : propertyRows.select(knex.raw('NULL AS matched_value')).limit(1);

  return knex('submission_feature as evidence_sf')
    .select(
      'evidence_sf.submission_feature_id',
      'evidence_sf.parent_submission_feature_id',
      'evidence_sf.feature_type_id',
      'evidence_value.matched_value'
    )
    .joinRaw('CROSS JOIN LATERAL (?) AS evidence_value', [matchedValues])
    .whereRaw(buildUploadScopeCondition('evidence_sf', scope, knex))
    .whereRaw('evidence_sf.feature_type_id = ANY(ARRAY(?))', [
      buildPredicateAssignmentFeatureTypeIdsQuery(property, knex)
    ]);
}

/**
 * Starts a query that defines one leaf's evidence (`upload_evidence`) and the two walks from it.
 *
 * The evidence is materialized because both walks and the final selection read it.
 *
 * @param {Knex.QueryBuilder} evidence Evidence query for the leaf.
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query with `upload_evidence`, `upload_ancestors` and `upload_descendants` defined.
 */
function withUploadRelationships(
  evidence: Knex.QueryBuilder,
  scope: SubmissionUploadScope,
  knex: Knex
): Knex.QueryBuilder {
  return knex
    .withMaterialized('upload_evidence', evidence)
    .withRecursive('upload_ancestors', UPLOAD_ANCESTOR_COLUMNS, buildUploadAncestorsWalk(scope, knex))
    .withRecursive('upload_descendants', UPLOAD_DESCENDANT_COLUMNS, buildUploadDescendantsWalk(scope, knex));
}

/**
 * Selects the walked features whose type differs from the evidence that reached them, the relationships through which
 * a value on one feature type describes a feature of another.
 *
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query (alias `upload_related`) returning related feature IDs and matched values.
 */
function buildUploadRelatedFeaturesQuery(knex: Knex): Knex.QueryBuilder {
  const walked = knex
    .select('submission_feature_id', 'feature_type_id', 'evidence_feature_type_id', 'matched_value')
    .from('upload_ancestors')
    .unionAll(
      knex
        .select('submission_feature_id', 'feature_type_id', 'evidence_feature_type_id', 'matched_value')
        .from('upload_descendants'),
      true
    );

  return knex
    .from(walked.as('upload_related'))
    .select('upload_related.submission_feature_id', 'upload_related.matched_value')
    .whereRaw('upload_related.feature_type_id <> upload_related.evidence_feature_type_id');
}

/**
 * Builds the recursive walk from the evidence to every feature it reaches: its parent chain and the features it
 * references, transitively and in any combination.
 *
 * The walk starts at the evidence's distinct first hop, so dense evidence (every telemetry point of an upload) enters the
 * recursion as its few parents rather than as itself. Each step is a lateral subquery holding only the key condition and
 * fenced with `OFFSET 0`, so every hop is one primary-key or reference-index probe; the upload boundary is applied to
 * the step's result, where it cannot steer the step onto an index that scans the upload. `UNION` removes repeated states,
 * which also ends walks around reference cycles.
 *
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.Raw} Recursive CTE body over `UPLOAD_ANCESTOR_COLUMNS`.
 */
function buildUploadAncestorsWalk(scope: SubmissionUploadScope, knex: Knex): Knex.Raw {
  return knex.raw(
    `
    SELECT target.submission_feature_id, target.parent_submission_feature_id, target.feature_type_id,
      hop.evidence_feature_type_id, hop.matched_value
    FROM (
      SELECT evidence.parent_submission_feature_id AS submission_feature_id,
        evidence.feature_type_id AS evidence_feature_type_id, evidence.matched_value
      FROM upload_evidence evidence
      WHERE evidence.parent_submission_feature_id IS NOT NULL
      UNION
      SELECT reference.referenced_submission_feature_id, evidence.feature_type_id, evidence.matched_value
      FROM upload_evidence evidence
      CROSS JOIN LATERAL (
        SELECT property_feature.referenced_submission_feature_id
        FROM submission_feature_property_feature property_feature
        WHERE property_feature.submission_feature_id = evidence.submission_feature_id
        OFFSET 0
      ) reference
    ) hop
    CROSS JOIN LATERAL (
      SELECT reached.submission_feature_id, reached.parent_submission_feature_id, reached.feature_type_id,
        reached.submission_id, reached.submission_upload_id, reached.record_end_date
      FROM submission_feature reached
      WHERE reached.submission_feature_id = hop.submission_feature_id
      OFFSET 0
    ) target
    WHERE ?
    UNION
    SELECT step.submission_feature_id, step.parent_submission_feature_id, step.feature_type_id,
      walk.evidence_feature_type_id, walk.matched_value
    FROM upload_ancestors walk
    CROSS JOIN LATERAL (
      SELECT parent.submission_feature_id, parent.parent_submission_feature_id, parent.feature_type_id,
        parent.submission_id, parent.submission_upload_id, parent.record_end_date
      FROM submission_feature parent
      WHERE parent.submission_feature_id = walk.parent_submission_feature_id
      UNION ALL
      SELECT referenced.submission_feature_id, referenced.parent_submission_feature_id, referenced.feature_type_id,
        referenced.submission_id, referenced.submission_upload_id, referenced.record_end_date
      FROM submission_feature_property_feature property_feature
      JOIN submission_feature referenced
        ON referenced.submission_feature_id = property_feature.referenced_submission_feature_id
      WHERE property_feature.submission_feature_id = walk.submission_feature_id
      OFFSET 0
    ) step
    WHERE ?
    `,
    [buildUploadScopeCondition('target', scope, knex), buildUploadScopeCondition('step', scope, knex)]
  );
}

/**
 * Builds the recursive walk from the evidence to every feature that reaches it: its descendants and the features
 * referring to it, transitively and in any combination.
 *
 * Children are found through `submission_feature_idx10` (current features by parent) and referrers through the
 * reference index on `referenced_submission_feature_id`. Each step is fenced like the ancestor walk, with only the key
 * condition (and the partial index's `record_end_date IS NULL`) inside the fence and the upload boundary applied to its
 * result. `UNION` removes repeated states, which also ends walks around reference cycles.
 *
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.Raw} Recursive CTE body over `UPLOAD_DESCENDANT_COLUMNS`.
 */
function buildUploadDescendantsWalk(scope: SubmissionUploadScope, knex: Knex): Knex.Raw {
  return knex.raw(
    `
    SELECT hop.submission_feature_id, hop.feature_type_id, evidence.feature_type_id, evidence.matched_value
    FROM upload_evidence evidence
    CROSS JOIN LATERAL (${buildUploadChildrenAndReferrersSql('evidence')}) hop
    WHERE ?
    UNION
    SELECT step.submission_feature_id, step.feature_type_id, walk.evidence_feature_type_id, walk.matched_value
    FROM upload_descendants walk
    CROSS JOIN LATERAL (${buildUploadChildrenAndReferrersSql('walk')}) step
    WHERE ?
    `,
    [buildUploadScopeCondition('hop', scope, knex), buildUploadScopeCondition('step', scope, knex)]
  );
}

/**
 * Builds the fenced lookup of a feature's current children and of the features referring to it.
 *
 * @param {string} sourceAlias Alias of the walk row whose `submission_feature_id` is looked up; a fixed identifier.
 * @returns {string} Subquery SQL returning the related features with their boundary columns.
 */
function buildUploadChildrenAndReferrersSql(sourceAlias: 'evidence' | 'walk'): string {
  return `
      SELECT child.submission_feature_id, child.feature_type_id,
        child.submission_id, child.submission_upload_id, child.record_end_date
      FROM submission_feature child
      WHERE child.parent_submission_feature_id = ${sourceAlias}.submission_feature_id
        AND child.record_end_date IS NULL
      UNION ALL
      SELECT referrer.submission_feature_id, referrer.feature_type_id,
        referrer.submission_id, referrer.submission_upload_id, referrer.record_end_date
      FROM submission_feature_property_feature property_feature
      JOIN submission_feature referrer ON referrer.submission_feature_id = property_feature.submission_feature_id
      WHERE property_feature.referenced_submission_feature_id = ${sourceAlias}.submission_feature_id
      OFFSET 0`;
}

/**
 * Projects matched feature IDs onto the upload features they identify, as the `anchor_sf` rows callers order and page.
 *
 * Each ID is resolved by a fenced primary-key lookup and the upload boundary is applied to the result, so resolving the
 * matches costs one probe per match even when stale statistics underestimate them. The evidence and every walk step
 * already hold to the boundary; checking it again here guarantees the evaluator only returns, and screening only
 * assigns, current features of the upload, whatever path produced the ID.
 *
 * @param {Knex.QueryBuilder} matches Query returning unique matching `submission_feature_id` values.
 * @param {SubmissionUploadScope} scope Upload being evaluated.
 * @param {Knex} knex Knex instance used to build the query.
 * @returns {Knex.QueryBuilder} Query over `anchor_sf` returning the matched feature IDs.
 */
function buildUploadMatchedAnchorsQuery(
  matches: Knex.QueryBuilder,
  scope: SubmissionUploadScope,
  knex: Knex
): Knex.QueryBuilder {
  const anchor = knex('submission_feature as upload_anchor')
    .select(
      'upload_anchor.submission_feature_id',
      'upload_anchor.feature_type_id',
      'upload_anchor.create_date',
      'upload_anchor.submission_id',
      'upload_anchor.submission_upload_id',
      'upload_anchor.record_end_date'
    )
    .whereRaw('upload_anchor.submission_feature_id = upload_matches.submission_feature_id')
    .offset(knex.raw('0') as unknown as number);

  return knex
    .from(matches.as('upload_matches'))
    .select('anchor_sf.submission_feature_id')
    .joinRaw('CROSS JOIN LATERAL (?) AS anchor_sf', [anchor])
    .whereRaw(buildUploadScopeCondition('anchor_sf', scope, knex));
}

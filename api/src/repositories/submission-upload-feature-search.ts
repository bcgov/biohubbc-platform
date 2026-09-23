import type { Knex } from 'knex';
import { getKnex } from '../database/db';
import { NormalizedExpressionTree, NormalizedExpressionTreeClause } from '../models/expression-tree-internal';
import type { SearchFeatureQueryOptions } from '../models/search-feature-pagination';
import { hasCompatiblePredicates } from '../utils/expression-optimization';
import {
  applyEvidenceFilters,
  applyPropertyReferenceLifecycleFilters,
  buildPredicateFeatureTypePropertyIdsQuery,
  getEvidencePredicates,
  getPredicateTableConfig,
  getScalarPredicateValues,
  isAndEqualityExpression
} from './expression-predicate-sql';
import { applySearchQueryOptions } from './search-feature-pagination-sql';

/**
 * Build upload-review candidates independently of published closure and public access filters.
 * Like published evidence closure, expression matching follows transitive combinations of
 * parent and feature-reference edges. Both endpoints stay within this upload; security
 * inheritance is computed separately using parent edges only.
 *
 * @param {number} submissionId Submission boundary.
 * @param {string} submissionUploadId Reviewed upload boundary.
 * @param {NormalizedExpressionTree} [expression] Normalized expression criteria.
 * @param {SearchFeatureQueryOptions} [options] Cursor ordering and page limit.
 * @returns {Knex.QueryBuilder} Upload feature IDs matching the expression.
 */
export function buildSubmissionUploadFeatureIdsSubquery(
  submissionId: number,
  submissionUploadId: string,
  expression?: NormalizedExpressionTree,
  options?: SearchFeatureQueryOptions
): Knex.QueryBuilder {
  const knex = getKnex();
  const query = knex
    .with(
      'upload_features',
      knex('submission_feature')
        .select('submission_feature_id', 'parent_submission_feature_id', 'feature_type_id', 'create_date')
        .where('submission_id', submissionId)
        .where('submission_upload_id', submissionUploadId)
        .whereNull('record_end_date')
    )
    .from('upload_features as anchor_sf')
    .select('anchor_sf.submission_feature_id')
    .join('feature_type as ft', 'ft.feature_type_id', 'anchor_sf.feature_type_id')
    .whereNull('ft.record_end_date');

  if (expression) {
    query.with(
      'upload_edges',
      knex.raw(`
      SELECT submission_feature_id AS source_submission_feature_id,
        submission_feature_id AS target_submission_feature_id FROM upload_features
      UNION
      SELECT child.submission_feature_id, parent.submission_feature_id
      FROM upload_features child JOIN upload_features parent
        ON parent.submission_feature_id = child.parent_submission_feature_id
      UNION
      SELECT source.submission_feature_id, target.submission_feature_id
      FROM upload_features source
      JOIN submission_feature_property_feature property ON property.submission_feature_id = source.submission_feature_id
      JOIN upload_features target ON target.submission_feature_id = property.referenced_submission_feature_id
    `)
    );
    query.withRecursive(
      'upload_relationships',
      knex.raw(`
      SELECT source_submission_feature_id, target_submission_feature_id FROM upload_edges
      UNION
      SELECT relationships.source_submission_feature_id, edge.target_submission_feature_id
      FROM upload_relationships relationships JOIN upload_edges edge
        ON edge.source_submission_feature_id = relationships.target_submission_feature_id
    `)
    );
    applySubmissionUploadExpressionClause(query, expression, knex);
  }

  applySearchQueryOptions(query, 'anchor_sf', options);
  return query;
}

/**
 * Recursively appends an upload-review clause without public visibility filtering.
 *
 * @example
 * A predicate appends one correlated evidence condition. A regular `AND(A, OR(B, C))` recursively creates nested Knex
 * groups. A compatible range or equality expression takes the coalesced single-scan pathway before general recursion.
 *
 * @param {Knex.QueryBuilder} query - Anchor query or nested boolean expression.
 * @param {NormalizedExpressionTreeClause} clause - Clause to append.
 * @param {Knex} knex - Knex instance used to build predicate subqueries.
 * @return {Knex.QueryBuilder} The query with the clause appended.
 */
function applySubmissionUploadExpressionClause(
  query: Knex.QueryBuilder,
  clause: NormalizedExpressionTreeClause,
  knex: Knex
): Knex.QueryBuilder {
  if (clause.type === 'predicate') {
    return query.whereRaw(buildSubmissionUploadEvidenceExpression(clause, knex));
  }

  if (hasCompatiblePredicates(clause)) {
    return query.whereRaw(
      isAndEqualityExpression(clause)
        ? buildSubmissionUploadAndEqualityExpression(clause, knex)
        : buildSubmissionUploadEvidenceExpression(clause, knex)
    );
  }

  return query.where((expressionGroup) => {
    clause.clauses.forEach((childClause, index) => {
      const appendChild = (childGroup: Knex.QueryBuilder) => {
        applySubmissionUploadExpressionClause(childGroup, childClause, knex);
      };

      if (index === 0 || clause.operator === 'AND') {
        expressionGroup.where(appendChild);
      } else {
        expressionGroup.orWhere(appendChild);
      }
    });
  });
}

/**
 * Builds an upload-review AND equality match across upload-local relationships.
 * Secured evidence remains eligible for administrative review.
 *
 * Evidence values are mapped to the current anchor before aggregation. This preserves
 * multi-valued semantics and allows separate upload-local related evidence features to
 * contribute different required values without repeating metadata and relationship work
 * once for every predicate.
 *
 * @example
 * `Count = 77 AND Count = 100` filters one property domain to both values, maps upload-local direct and related evidence to
 * the current anchor, then applies `COUNT(DISTINCT matched_value) = 2`. This preserves multi-valued AND semantics while
 * avoiding two complete metadata and relationship probes.
 *
 * @param {NormalizedExpressionTree} expression - AND expression containing same-property equality predicates.
 * @param {Knex} knex - Knex instance used to build the expression.
 * @return {Knex.Raw} Correlated boolean expression for the current anchor.
 */
function buildSubmissionUploadAndEqualityExpression(expression: NormalizedExpressionTree, knex: Knex): Knex.Raw {
  const predicates = getEvidencePredicates(expression);
  const property = predicates[0];
  const { tableName, valueColumn } = getPredicateTableConfig(property.internal_predicate);
  const values = getScalarPredicateValues(predicates);

  const directRows = applyPropertyReferenceLifecycleFilters(
    knex(`${tableName} as p`)
      .select({ matched_value: valueColumn })
      .whereRaw('p.submission_feature_id = anchor_sf.submission_feature_id')
      .whereIn(
        'p.feature_type_property_id',
        buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
          'ftp.feature_type_id = anchor_sf.feature_type_id'
        )
      )
      .whereIn(valueColumn, values),
    property.internal_predicate
  );

  /**
   * Maps related equality evidence to the current search anchor in one direction through upload-local relationships.
   *
   * @param {string} relationshipAlias - Unique alias for the upload-local relationship relation.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} anchorColumn - Relationship column containing the anchor ID.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} evidenceColumn - Relationship column containing the evidence ID.
   * @return {Knex.QueryBuilder} Query returning matched values within the upload.
   */
  const buildRelatedRows = (
    relationshipAlias: string,
    anchorColumn: 'source_submission_feature_id' | 'target_submission_feature_id',
    evidenceColumn: 'source_submission_feature_id' | 'target_submission_feature_id'
  ) => {
    return applyPropertyReferenceLifecycleFilters(
      knex(`upload_relationships as ${relationshipAlias}`)
        .select({ matched_value: valueColumn })
        .join(`${tableName} as p`, 'p.submission_feature_id', `${relationshipAlias}.${evidenceColumn}`)
        .whereRaw(`${relationshipAlias}.${anchorColumn} = anchor_sf.submission_feature_id`)
        .whereIn(
          'p.feature_type_property_id',
          buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
            'ftp.feature_type_id <> anchor_sf.feature_type_id'
          )
        )
        .whereIn(valueColumn, values),
      property.internal_predicate
    );
  };

  const mappedEvidence = directRows.unionAll(
    [
      buildRelatedRows('grouped_search_forward', 'source_submission_feature_id', 'target_submission_feature_id'),
      buildRelatedRows('grouped_search_reverse', 'target_submission_feature_id', 'source_submission_feature_id')
    ],
    true
  );
  const match = knex
    .from(mappedEvidence.as('grouped_search_evidence'))
    .select(knex.raw('true'))
    .havingRaw('count(DISTINCT grouped_search_evidence.matched_value) = ?', [values.length])
    .limit(1);

  return knex.raw('(?) IS TRUE', [match]);
}

/**
 * Builds an upload-review evidence probe across upload-local relationships.
 * Public visibility does not restrict administrative expression evidence.
 *
 * The leaf contains three correlated scalar probes: direct same-type evidence,
 * cross-type evidence reached forward through upload relationships, and cross-type evidence
 * reached in reverse. The scalar shape intentionally keeps each probe correlated; if
 * PostgreSQL decorrelates these broad predicates it may materialize millions of
 * evidence rows before the outer page LIMIT can stop the anchor scan.
 *
 * @example
 * For a Survey predicate and SampleSite anchor, the returned boolean is true when the anchor itself has matching
 * same-type evidence or when upload-local Survey evidence is connected to it through upload relationships in either direction.
 *
 * @param {NormalizedExpressionTreeClause} evidence - Predicate or compatible same-property expression.
 * @param {Knex} knex - Knex instance used to build the subquery.
 * @return {Knex.Raw} Correlated boolean expression for the anchor WHERE clause.
 */
function buildSubmissionUploadEvidenceExpression(evidence: NormalizedExpressionTreeClause, knex: Knex): Knex.Raw {
  const predicates = getEvidencePredicates(evidence);
  const property = predicates[0];
  const operator = evidence.type === 'expression' ? evidence.operator : 'AND';
  const { tableName } = getPredicateTableConfig(property.internal_predicate);

  const directEvidence = applyEvidenceFilters(
    knex(`${tableName} as p`)
      .select(knex.raw('true'))
      .whereRaw('p.submission_feature_id = anchor_sf.submission_feature_id')
      .whereIn(
        'p.feature_type_property_id',
        buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
          'ftp.feature_type_id = anchor_sf.feature_type_id'
        )
      ),
    predicates,
    knex,
    operator
  ).limit(1);

  /**
   * Probe upload-local evidence in one relationship direction without public visibility filtering.
   * @param {string} relationshipAlias Alias for upload-local relationships.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} anchorColumn Column containing the anchor ID.
   * @param {'source_submission_feature_id' | 'target_submission_feature_id'} evidenceColumn Column containing the evidence ID.
   * @returns {Knex.QueryBuilder} Correlated evidence probe for administrative review.
   */
  const buildCrossTypeEvidence = (
    relationshipAlias: string,
    anchorColumn: 'source_submission_feature_id' | 'target_submission_feature_id',
    evidenceColumn: 'source_submission_feature_id' | 'target_submission_feature_id'
  ) => {
    return applyEvidenceFilters(
      knex(`upload_relationships as ${relationshipAlias}`)
        .select(knex.raw('true'))
        .join(`${tableName} as p`, 'p.submission_feature_id', `${relationshipAlias}.${evidenceColumn}`)
        .whereRaw(`${relationshipAlias}.${anchorColumn} = anchor_sf.submission_feature_id`)
        .whereIn(
          'p.feature_type_property_id',
          buildPredicateFeatureTypePropertyIdsQuery(property, knex).whereRaw(
            'ftp.feature_type_id <> anchor_sf.feature_type_id'
          )
        ),
      predicates,
      knex,
      operator
    ).limit(1);
  };

  const forwardEvidence = buildCrossTypeEvidence(
    'upload_forward',
    'source_submission_feature_id',
    'target_submission_feature_id'
  );
  const reverseEvidence = buildCrossTypeEvidence(
    'upload_reverse',
    'target_submission_feature_id',
    'source_submission_feature_id'
  );

  // Scalar subqueries retain their correlation under PostgreSQL planning. A
  // regular EXISTS here can be rewritten into a hashed global evidence set,
  // defeating page LIMIT for common predicates on multi-million-row tables.
  return knex.raw('((?) IS TRUE OR (?) IS TRUE OR (?) IS TRUE)', [directEvidence, forwardEvidence, reverseEvidence]);
}

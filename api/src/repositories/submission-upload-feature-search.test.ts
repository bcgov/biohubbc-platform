import { expect } from 'chai';
import { describe } from 'mocha';
import { NormalizedExpressionTree, NormalizedExpressionTreePredicate } from '../models/expression-tree-internal';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { buildSubmissionUploadFeatureIdsSubquery } from './submission-upload-feature-search';

const UPLOAD_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Build a normalized string equality predicate.
 *
 * @param {number} featurePropertyId Property the predicate reads.
 * @param {string} value Value the property must equal.
 * @returns {NormalizedExpressionTreePredicate} Normalized predicate.
 */
function equals(featurePropertyId: number, value: string): NormalizedExpressionTreePredicate {
  return {
    type: 'predicate',
    feature_property_id: featurePropertyId,
    blueprint_feature_type_property_id: null,
    operator: 'Equals',
    value,
    feature_property_type_id: 1,
    feature_property_type_name: FEATURE_PROPERTY_TYPE.STRING,
    internal_predicate: { type: 'string', operator: 'Equals', value }
  };
}

/**
 * Render the upload feature query for an expression.
 *
 * @param {NormalizedExpressionTree} [expression] Expression to evaluate; omitted for every upload feature.
 * @returns {{ sql: string; bindings: readonly unknown[] }} Native SQL and bindings.
 */
function render(expression?: NormalizedExpressionTree): { sql: string; bindings: readonly unknown[] } {
  return buildSubmissionUploadFeatureIdsSubquery(7, UPLOAD_ID, expression).toSQL().toNative();
}

describe('buildSubmissionUploadFeatureIdsSubquery', () => {
  it('selects current upload features of active types without walking when no expression is given', () => {
    const { sql, bindings } = render();

    expect(sql).to.include('from "submission_feature" as "anchor_sf"');
    expect(sql).to.include(
      'anchor_sf.feature_type_id = ANY(ARRAY((select "feature_type_id" from "feature_type" where "record_end_date" is null)))'
    );
    expect(sql).not.to.include('upload_evidence');
    expect(bindings).to.eql([7, UPLOAD_ID]);
  });

  it('evaluates a predicate from its evidence and walks to ancestors and descendants', () => {
    const { sql } = render({ type: 'expression', operator: 'AND', clauses: [equals(5, 'owl')] });

    expect(sql).to.include('"upload_evidence" as materialized');
    expect(sql).to.include('"upload_ancestors"("submission_feature_id"');
    expect(sql).to.include('"upload_descendants"("submission_feature_id"');
    expect(sql).to.include('upload_related.feature_type_id <> upload_related.evidence_feature_type_id');
    expect(sql).not.to.include('submission_feature_closure');
  });

  it('applies the upload boundary to the evidence, every walk step and the anchor', () => {
    const { sql, bindings } = render({ type: 'expression', operator: 'AND', clauses: [equals(5, 'owl')] });

    // Evidence, the ancestor walk's first hop and step, the descendant walk's first hop and step, and the anchor.
    expect(bindings.filter((binding) => binding === UPLOAD_ID)).to.have.lengthOf(6);
    expect(sql.match(/OFFSET 0/gi)).to.have.lengthOf(6);
  });

  it('collapses a single-clause expression and combines other clauses with intersect or union', () => {
    const single = render({ type: 'expression', operator: 'AND', clauses: [equals(5, 'owl')] }).sql;
    const conjunction = render({
      type: 'expression',
      operator: 'AND',
      clauses: [equals(5, 'owl'), equals(6, 'north')]
    }).sql;
    const disjunction = render({
      type: 'expression',
      operator: 'OR',
      clauses: [equals(5, 'owl'), equals(6, 'north')]
    }).sql;

    expect(single).not.to.include('upload_clause_');
    expect(conjunction).to.include(' intersect (select "upload_clause_1"."submission_feature_id"');
    expect(disjunction).to.include(' union (select "upload_clause_1"."submission_feature_id"');
  });

  it('aggregates an AND of equalities over the direct and related values of each feature', () => {
    const { sql, bindings } = render({
      type: 'expression',
      operator: 'AND',
      clauses: [equals(5, 'owl'), equals(5, 'elk')]
    });

    expect(sql).to.include('select distinct "p"."value" as "matched_value"');
    expect(sql).to.match(/count\(DISTINCT upload_grouped_evidence\.matched_value\) = \$\d+/);
    expect(bindings).to.include(2);
  });

  it('orders and limits the anchor alias for a cursor page', () => {
    const { sql } = buildSubmissionUploadFeatureIdsSubquery(
      7,
      UPLOAD_ID,
      { type: 'expression', operator: 'AND', clauses: [equals(5, 'owl')] },
      { sort: 'create_date', order: 'desc', limit: 26 }
    )
      .toSQL()
      .toNative();

    expect(sql).to.include('order by "anchor_sf"."create_date" desc, "anchor_sf"."submission_feature_id" desc limit');
  });
});

/**
 * Pure SQL builders for tag rule matching.
 *
 * Each builder restricts a ticket query (alias `t`) to tickets one tag rule expression matches, so every rule compiles
 * to one condition over a single ticket.
 */

import { Knex } from 'knex';
import { NormalizedExpressionTree } from '../models/expression-tree-internal';
import { TicketSubmissionUploadScope } from '../models/tag-rule';
import { buildSubmissionUploadFeatureIdsSubquery } from './submission-upload-feature-search';

/**
 * Condition that a feature of one of the given submission uploads matches the expression. Uploads are evaluated within
 * their own boundary, following parent and feature-reference relationships as automatic security screening does.
 *
 * @param {Knex.QueryBuilder} builder Where-builder of the ticket query.
 * @param {NormalizedExpressionTree} expression Normalized rule expression.
 * @param {TicketSubmissionUploadScope[]} uploads The ticket's active submission uploads.
 * @returns {void}
 */
export function orWhereSubmissionUploadMatchesExpression(
  builder: Knex.QueryBuilder,
  expression: NormalizedExpressionTree,
  uploads: TicketSubmissionUploadScope[]
): void {
  for (const upload of uploads) {
    builder.orWhereExists(
      buildSubmissionUploadFeatureIdsSubquery(upload.submission_id, upload.submission_upload_id, expression).limit(1)
    );
  }
}

/**
 * Condition that one of the ticket's active data requests has an expression referring to what the rule expression
 * refers to: a non-taxon predicate on the same property, or a taxon predicate on one of the rule's taxa or a
 * descendant of one.
 *
 * Both expression trees are walked from their stored roots. Taxon lineage walks up from each request taxon, so the
 * cost follows the depth of the hierarchy rather than the size of the rule taxa's subtrees.
 *
 * @param {Knex.QueryBuilder} builder Where-builder of the ticket query (alias `t`).
 * @param {string} expressionId Root expression id of the rule.
 * @returns {void}
 */
export function orWhereDataRequestReferencesExpression(builder: Knex.QueryBuilder, expressionId: string): void {
  builder.orWhereRaw(
    `EXISTS (
      WITH RECURSIVE rule_expression(expression_id) AS (
        SELECT ?::uuid
        UNION
        SELECT ec.child_expression_id
        FROM expression_clause ec
        JOIN rule_expression re ON re.expression_id = ec.expression_id
        WHERE ec.child_expression_id IS NOT NULL
          AND ec.record_end_date IS NULL
      ),
      rule_predicate AS (
        SELECT pr.feature_property_id, px.taxon_id
        FROM rule_expression re
        JOIN expression_clause ec ON ec.expression_id = re.expression_id AND ec.record_end_date IS NULL
        JOIN predicate pr ON pr.predicate_id = ec.predicate_id
        LEFT JOIN predicate_taxon px ON px.predicate_id = pr.predicate_id AND px.record_end_date IS NULL
      ),
      request_expression(expression_id) AS (
        SELECT pe.expression_id
        FROM data_request dr
        JOIN policy_statement ps ON ps.policy_id = dr.policy_id AND ps.record_end_date IS NULL
        JOIN policy_expression pe ON pe.policy_expression_id = ps.policy_expression_id AND pe.record_end_date IS NULL
        WHERE dr.ticket_id = t.ticket_id
          AND dr.record_end_date IS NULL
        UNION
        SELECT ec.child_expression_id
        FROM expression_clause ec
        JOIN request_expression re ON re.expression_id = ec.expression_id
        WHERE ec.child_expression_id IS NOT NULL
          AND ec.record_end_date IS NULL
      ),
      request_predicate AS (
        SELECT pr.feature_property_id, px.taxon_id
        FROM request_expression re
        JOIN expression_clause ec ON ec.expression_id = re.expression_id AND ec.record_end_date IS NULL
        JOIN predicate pr ON pr.predicate_id = ec.predicate_id
        LEFT JOIN predicate_taxon px ON px.predicate_id = pr.predicate_id AND px.record_end_date IS NULL
      ),
      request_taxon_lineage(taxon_id, parent_taxon_id) AS (
        SELECT tx.taxon_id, tx.parent_taxon_id
        FROM taxon tx
        WHERE tx.taxon_id IN (SELECT taxon_id FROM request_predicate WHERE taxon_id IS NOT NULL)
        UNION
        SELECT tx.taxon_id, tx.parent_taxon_id
        FROM taxon tx
        JOIN request_taxon_lineage l ON tx.taxon_id = l.parent_taxon_id
      )
      SELECT 1
      FROM rule_predicate rp
      WHERE (
        rp.taxon_id IS NULL
        AND EXISTS (
          SELECT 1 FROM request_predicate rq WHERE rq.taxon_id IS NULL AND rq.feature_property_id = rp.feature_property_id
        )
      )
      OR (
        rp.taxon_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM request_taxon_lineage l WHERE l.taxon_id = rp.taxon_id)
      )
    )`,
    [expressionId]
  );
}

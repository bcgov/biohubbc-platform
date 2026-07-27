import { MaterializedViewTaxonRule, MaterializedViewTaxonRuleRegistry } from '../types';

const buildBranchPredicate = (rule: MaterializedViewTaxonRule): string => {
  if (!rule.branches.length) {
    return 'FALSE';
  }

  return rule.branches
    .map((branch) => {
      const rootMatch = `EXISTS (
          SELECT 1
          FROM taxon_ancestors branch_root
          WHERE branch_root.itis_tsn = ${branch.rootItisTsn}
        )`;

      if (!branch.exceptDescendantItisTsns?.length) {
        return `(${rootMatch})`;
      }

      return `(
        ${rootMatch}
        AND NOT EXISTS (
          SELECT 1
          FROM taxon_ancestors exception
          WHERE exception.itis_tsn IN (${branch.exceptDescendantItisTsns.join(', ')})
        )
      )`;
    })
    .join('\n        OR ');
};

const combineRulePredicates = (rules: MaterializedViewTaxonRule[]): string =>
  rules.map((rule) => `(${buildBranchPredicate(rule)})`).join('\n        OR ');

/**
 * Build a materialized-view taxon filter from reusable named rules.
 *
 * The recursive CTE starts at the row's taxon and follows the self-referencing `parent_taxon_id` until
 * it reaches a root or a previously visited row. Include rules are combined with OR, exclude rules are
 * combined with OR, and exclusions take precedence when both kinds are configured.
 */
export function buildTaxonRuleFilter(
  registry: MaterializedViewTaxonRuleRegistry,
  ruleNames: string[],
  taxonIdExpression: string
): string {
  if (!ruleNames.length) {
    return '';
  }

  const rules = ruleNames.map((ruleName) => {
    const rule = registry[ruleName];

    if (!rule) {
      throw new Error(`Unknown materialized-view taxon rule: ${ruleName}`);
    }

    return rule;
  });
  const includeRules = rules.filter((rule) => rule.effect === 'include');
  const excludeRules = rules.filter((rule) => rule.effect === 'exclude');
  const includePredicate = includeRules.length ? `(${combineRulePredicates(includeRules)})` : 'TRUE';
  const excludePredicate = excludeRules.length ? `NOT (${combineRulePredicates(excludeRules)})` : 'TRUE';
  const nullTaxonPredicate = includeRules.length ? '' : `${taxonIdExpression} IS NULL\n  OR `;

  return `AND (
  ${nullTaxonPredicate}EXISTS (
      WITH RECURSIVE taxon_ancestors AS (
        SELECT
          taxon_id,
          itis_tsn,
          parent_taxon_id,
          ARRAY[taxon_id] AS visited_taxon_ids
        FROM biohub.taxon
        WHERE taxon_id = ${taxonIdExpression}
          AND record_end_date IS NULL

        UNION ALL

        SELECT
          parent.taxon_id,
          parent.itis_tsn,
          parent.parent_taxon_id,
          ancestor.visited_taxon_ids || parent.taxon_id
        FROM biohub.taxon parent
        JOIN taxon_ancestors ancestor
          ON parent.taxon_id = ancestor.parent_taxon_id
        WHERE parent.record_end_date IS NULL
          AND NOT parent.taxon_id = ANY(ancestor.visited_taxon_ids)
      )
      SELECT 1
      WHERE ${includePredicate}
        AND ${excludePredicate}
  )
)`;
}

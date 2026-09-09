interface TaxonBranch {
  rootItisTsn: number;
  exceptDescendantItisTsns?: number[];
}

const EXCLUDED_FISH_TAXON_BRANCHES: TaxonBranch[] = [
  { rootItisTsn: 161061 }, // Actinopterygii
  {
    rootItisTsn: 161048, // Sarcopterygii
    exceptDescendantItisTsns: [914181] // Tetrapoda
  },
  { rootItisTsn: 159785 }, // Chondrichthyes
  { rootItisTsn: 914178 } // Agnatha
];

export const effectivelySecuredExpression = (featureIdExpression: string): string => `(
  EXISTS (
    SELECT 1
    FROM biohub.submission_feature_closure security_closure
    JOIN biohub.submission_feature_security feature_security
      ON feature_security.submission_feature_id = security_closure.target_submission_feature_id
    JOIN biohub.submission_feature secured_feature
      ON secured_feature.submission_feature_id = security_closure.target_submission_feature_id
    WHERE security_closure.source_submission_feature_id = ${featureIdExpression}
      AND security_closure.is_ancestor = true
      AND feature_security.record_end_date IS NULL
      AND secured_feature.record_effective_date <= NOW()
  )
  OR NOT EXISTS (
    SELECT 1
    FROM biohub.submission_feature_closure security_closure
    WHERE security_closure.source_submission_feature_id = ${featureIdExpression}
      AND security_closure.target_submission_feature_id = ${featureIdExpression}
  )
)`;

const buildTaxonBranchPredicate = (branch: TaxonBranch): string => {
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
};

export const buildTaxonFilter = (taxonIdExpression: string): string => `AND (
  ${taxonIdExpression} IS NULL
  OR EXISTS (
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
    WHERE NOT (
      ${EXCLUDED_FISH_TAXON_BRANCHES.map(buildTaxonBranchPredicate).join('\n      OR ')}
    )
  )
)`;

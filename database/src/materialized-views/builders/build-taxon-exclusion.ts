import { MaterializedViewTaxonExclusionConfig } from '../types';

const quoteSqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export function buildTaxonExclusionFilter(
  config: MaterializedViewTaxonExclusionConfig,
  taxonIdExpression: string
): string {
  const branches = config.excludedBranches;

  if (branches.length === 0) {
    return '';
  }

  const branchPredicates = branches
    .map((branch) => {
      const rootPredicate = `root.itis_scientific_name = ${quoteSqlLiteral(branch.rootScientificName)}`;

      if (!branch.exceptDescendantScientificNames?.length) {
        return `(${rootPredicate})`;
      }

      const exceptions = branch.exceptDescendantScientificNames.map(quoteSqlLiteral).join(', ');

      return `(
        ${rootPredicate}
        AND NOT EXISTS (
          SELECT 1
          FROM taxon_ancestors exception
          WHERE exception.itis_scientific_name IN (${exceptions})
        )
      )`;
    })
    .join('\n      OR ');

  return `AND (
    ${taxonIdExpression} IS NULL
    OR NOT EXISTS (
      WITH RECURSIVE taxon_ancestors AS (
        SELECT
          taxon_id,
          itis_tsn,
          itis_scientific_name,
          NULLIF(itis_data->>'parentTSN', '')::integer AS parent_tsn
        FROM biohub.taxon
        WHERE taxon_id = ${taxonIdExpression}
          AND record_end_date IS NULL

        UNION ALL

        SELECT
          parent.taxon_id,
          parent.itis_tsn,
          parent.itis_scientific_name,
          NULLIF(parent.itis_data->>'parentTSN', '')::integer AS parent_tsn
        FROM biohub.taxon parent
        JOIN taxon_ancestors ancestor
          ON parent.itis_tsn = ancestor.parent_tsn
        WHERE parent.record_end_date IS NULL
      )
      SELECT 1
      FROM taxon_ancestors root
      WHERE ${branchPredicates}
    )
  )`;
}

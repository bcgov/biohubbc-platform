import { MaterializedViewTaxonRuleRegistry, TaxonRuleBranch } from '../types';

/**
 * Reusable taxonomy rules for materialized views.
 *
 * Rules use stable ITIS TSNs for branch selection. The SQL builder resolves those branches by walking
 * from each row's `taxon_id` to its ancestors through `parent_taxon_id`; database-generated taxon IDs
 * are deliberately not stored in configuration.
 *
 * Add future rules here and assign their names to the relevant materialized-view definitions.
 */
const FISH_BRANCHES: TaxonRuleBranch[] = [
  { rootItisTsn: 161061 }, // Actinopterygii
  {
    rootItisTsn: 161048, // Sarcopterygii
    exceptDescendantItisTsns: [914181] // Tetrapoda
  },
  { rootItisTsn: 159785 }, // Chondrichthyes
  { rootItisTsn: 914178 } // Agnatha
];

export const TAXON_RULES: MaterializedViewTaxonRuleRegistry = {
  excludeFish: {
    effect: 'exclude',
    branches: FISH_BRANCHES
  }
};

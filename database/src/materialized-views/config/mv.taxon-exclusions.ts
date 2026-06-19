import { MaterializedViewTaxonExclusionConfig } from '../types';

export const TAXON_EXCLUSION_CONFIG: MaterializedViewTaxonExclusionConfig = {
  excludedBranches: [
    { rootScientificName: 'Actinopterygii' },
    {
      rootScientificName: 'Sarcopterygii',
      exceptDescendantScientificNames: ['Tetrapoda']
    },
    { rootScientificName: 'Chondrichthyes' },
    { rootScientificName: 'Agnatha' }
  ]
};

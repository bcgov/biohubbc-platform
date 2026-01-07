import { mdiMagnify, mdiSourceBranch } from '@mdi/js';
import Icon from '@mdi/react';
import { Box } from '@mui/material';
import { FEATURE_TYPE_CONFIG } from 'constants/feature-type';
import { SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';
import { pluralize } from 'utils/Utils';
import { SearchOptionItem } from '../components/SearchOptionItem';
import { SearchSectionHeader } from '../record/header/SearchSectionHeader';

export interface SearchSummarySectionProps {
  results: SearchSummaryResponse;
  onItemSelect: (query: string) => void;
}

export const SearchSummarySection = ({ results, onItemSelect }: SearchSummarySectionProps) => {
  const hasFeatureResults = results.features.length > 0;
  const hasTaxonomyResults = results.taxonomy?.total > 0;

  const featureItems = useMemo(
    () =>
      results.features.map((feature) => {
        const config = FEATURE_TYPE_CONFIG[feature.feature_type_name];
        const label = config?.label ?? feature.feature_type_name;
        const countLabel = pluralize(feature.total, 'result');

        return (
          <SearchOptionItem
            key={feature.feature_type_name}
            name={label}
            description={`${feature.total} ${countLabel}`}
            startIcon={<Icon path={mdiMagnify} size={1} style={{ display: 'block' }} />}
            onSelect={() => onItemSelect(feature.feature_type_name)}
          />
        );
      }),
    [results.features, onItemSelect]
  );

  const taxonomyItem = useMemo(() => {
    if (!hasTaxonomyResults) {
      return null;
    }

    const countLabel = pluralize(results.taxonomy.total, 'result');

    return (
      <SearchOptionItem
        name="Species"
        description={`${results.taxonomy.total} ${countLabel}`}
        startIcon={<Icon path={mdiSourceBranch} size={1} style={{ display: 'block' }} />}
        onSelect={() => onItemSelect('species')}
      />
    );
  }, [hasTaxonomyResults, results.taxonomy, onItemSelect]);

  if (!hasFeatureResults && !hasTaxonomyResults) {
    return null;
  }

  return (
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {featureItems}

      {hasTaxonomyResults && (
        <>
          <li>
            <SearchSectionHeader label="Species" />
          </li>
          {taxonomyItem}
        </>
      )}
    </Box>
  );
};

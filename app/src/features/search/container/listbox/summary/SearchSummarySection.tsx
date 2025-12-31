import { mdiMagnify, mdiSourceBranch } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material';
import { FEATURE_TYPE_CONFIG } from 'constants/feature-type';
import { SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';
import { pluralize } from 'utils/Utils';
import { SearchSectionHeader } from '../record/header/SearchSectionHeader';

export interface SearchSummarySectionProps {
  results: SearchSummaryResponse;
  onItemSelect: (query: string) => void;
}

export const SearchSummarySection = ({ results, onItemSelect }: SearchSummarySectionProps) => {
  const hasFeatureResults = results.features.length > 0;
  const hasTaxonomyResults = results.taxonomy?.total > 0;

  // Features list
  const featureItems = useMemo(
    () =>
      results.features.map((feature) => {
        const config = FEATURE_TYPE_CONFIG[feature.feature_type_name];
        const label = config?.label ?? feature.feature_type_name;
        const countLabel = pluralize(feature.total, 'result');

        return (
          <ListItemButton
            role="option"
            key={feature.feature_type_name}
            onClick={() => onItemSelect(feature.feature_type_name)}
            data-search-item
            sx={{ borderRadius: 1 }}>
            <ListItemIcon>
              <Icon path={mdiMagnify} size={1} style={{ display: 'block' }} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center">
                  <Box flex="1 1 auto">{label}</Box>
                  <Box flex="0 0 auto" color="text.secondary">
                    {`${feature.total} ${countLabel}`}
                  </Box>
                </Box>
              }
              sx={{ m: 0 }}
            />
          </ListItemButton>
        );
      }),
    [results.features, onItemSelect]
  );

  // Taxonomy / Species list
  const taxonomyItem = useMemo(() => {
    if (!hasTaxonomyResults) {
      return null;
    }

    const countLabel = pluralize(results.taxonomy.total, 'result');

    return (
      <ListItemButton role="option" onClick={() => onItemSelect('species')} data-search-item sx={{ borderRadius: 1 }}>
        <ListItemIcon>
          <Icon path={mdiSourceBranch} size={1} style={{ display: 'block' }} />
        </ListItemIcon>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center">
              <Box flex="1 1 auto">Species</Box>
              <Box flex="0 0 auto" color="text.secondary">
                {`${results.taxonomy.total} ${countLabel}`}
              </Box>
            </Box>
          }
          sx={{ m: 0 }}
        />
      </ListItemButton>
    );
  }, [hasTaxonomyResults, results.taxonomy, onItemSelect]);

  if (!hasFeatureResults && !hasTaxonomyResults) {
    return null;
  }

  return (
    <Stack>
      {hasFeatureResults && <>{featureItems}</>}

      {taxonomyItem && (
        <>
          <SearchSectionHeader label="Species" />
          {taxonomyItem}
        </>
      )}
    </Stack>
  );
};

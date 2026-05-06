import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, ListItemButton, ListItemIcon, ListItemText, Stack } from '@mui/material';
import { FEATURE_TYPE_CONFIG } from 'constants/feature-type';
import { SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { useMemo } from 'react';
import { pluralize } from 'utils/Utils';

export interface SearchSummarySectionProps {
  results: SearchSummaryResponse;
  searchTerm: string;
  defaultFeatureTypeName: string;
  onItemSelect: (query: string, featureTypeName: string) => void;
}

export const SearchSummarySection = ({
  results,
  searchTerm,
  defaultFeatureTypeName,
  onItemSelect
}: SearchSummarySectionProps) => {
  const hasFeatureResults = results.features.length > 0;
  const hasTaxonomyResults = results.taxonomy?.total > 0;

  const allItems = useMemo(() => {
    const items = [];

    // Add feature items
    results.features.forEach((feature) => {
      const config = FEATURE_TYPE_CONFIG[feature.feature_type_name];
      const label = config?.label ?? feature.feature_type_name;
      const countLabel = pluralize(feature.total, 'result');

      items.push({
        key: feature.feature_type_name,
        label,
        count: feature.total,
        countLabel,
        featureTypeName: feature.feature_type_name
      });
    });

    // Add taxonomy/species item
    if (hasTaxonomyResults) {
      const countLabel = pluralize(results.taxonomy.total, 'result');
      items.push({
        key: 'species',
        label: 'Species',
        count: results.taxonomy.total,
        countLabel,
        featureTypeName: defaultFeatureTypeName
      });
    }

    return items;
  }, [defaultFeatureTypeName, results.features, hasTaxonomyResults, results.taxonomy]);

  if (!hasFeatureResults && !hasTaxonomyResults) {
    return null;
  }

  return (
    <Stack>
      {allItems.map((item) => (
        <ListItemButton
          role="option"
          key={item.key}
          onClick={() => onItemSelect(searchTerm, item.featureTypeName)}
          data-search-item
          sx={{ borderRadius: 1 }}>
          <ListItemIcon>
            <Icon path={mdiMagnify} size={1} style={{ display: 'block' }} />
          </ListItemIcon>
          <ListItemText
            primary={
              <Box display="flex" alignItems="center">
                <Box flex="1 1 auto">{item.label}</Box>
                <Box flex="0 0 auto" color="text.secondary">
                  {item.count} {item.countLabel}
                </Box>
              </Box>
            }
          />
        </ListItemButton>
      ))}
    </Stack>
  );
};

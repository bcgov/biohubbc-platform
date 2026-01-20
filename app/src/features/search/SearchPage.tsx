import { Container, Paper, Stack, Typography } from '@mui/material';
import { FEATURE_TYPE_CONFIG, PRIORITY_FEATURE_TYPE } from 'constants/feature-type';
import { URL_PARAMS } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect, useMemo } from 'react';
import { SearchContainer } from './container/SearchContainer';

/**
 * Main search page and entry point for browsing and downloading biodiversity data.
 * Displays a search interface with quick links to filtered feature type views.
 */
export const SearchPage = () => {
  const api = useApi();

  const featureTypesDataLoader = useDataLoader(() => api.codes.getAllCodeSets());

  useEffect(() => {
    featureTypesDataLoader.load();
  }, [featureTypesDataLoader]);

  /**
   * Build navigation links for each feature type that has a configured label.
   * Links navigate to the list page with the feature type filter applied.
   */
  const featureTypeLinks = useMemo(
    () =>
      featureTypesDataLoader.data?.feature_type_with_properties
        .map((featureType) => {
          const typeName = featureType.feature_type.feature_type_name;

          // Only include types that are in the priority enum
          if (!Object.values(PRIORITY_FEATURE_TYPE).includes(typeName as PRIORITY_FEATURE_TYPE)) {
            return null;
          }

          const label = FEATURE_TYPE_CONFIG[typeName as PRIORITY_FEATURE_TYPE]?.label;

          return {
            label,
            to: `list?${URL_PARAMS.FEATURE_TYPE}=${typeName}`
          };
        })
        .filter((link): link is NonNullable<typeof link> => link !== null) ?? [],
    [featureTypesDataLoader.data?.feature_type_with_properties]
  );

  const isLoading = featureTypesDataLoader.isLoading || !featureTypesDataLoader.isReady;

  return (
    <Container maxWidth="md" sx={{ py: 10 }}>
      <Paper
        elevation={1}
        variant="elevation"
        sx={{
          p: 4,
          position: 'relative'
        }}>
        <Stack gap={3}>
          <Typography variant="h2">Search Biodiversity Data</Typography>
          <SearchContainer links={featureTypeLinks} isLoading={isLoading} />
        </Stack>
      </Paper>
    </Container>
  );
};

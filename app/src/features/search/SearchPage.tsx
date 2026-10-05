import { Container, Paper, Stack, Typography } from '@mui/material';
import { useCodesQuery } from 'hooks/useCodesQuery';
import { useMemo } from 'react';
import { SearchContainer } from './container/SearchContainer';
import { FeaturedDownloadsSection } from './gallery/FeaturedDownloadsSection';
import { buildSearchFeatureTypeLinks } from './utils/search-feature-type-links';

/**
 * Main search page and entry point for browsing and downloading biodiversity data.
 * Displays a search interface with quick links to filtered feature type views.
 */
export const SearchPage = () => {
  const codesQuery = useCodesQuery();

  const featureTypeLinks = useMemo(
    () => buildSearchFeatureTypeLinks(codesQuery.data?.feature_type_with_properties),
    [codesQuery.data?.feature_type_with_properties]
  );

  const isLoading = !codesQuery.isFetched;

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
      <FeaturedDownloadsSection />
    </Container>
  );
};

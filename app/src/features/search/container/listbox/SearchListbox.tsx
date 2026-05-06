import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { grey } from '@mui/material/colors';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { URL_PARAMS } from 'constants/query-params';
import { SearchResponse, SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { SearchResultsSection } from './record/SearchResultsSection';
import { SearchSummarySection } from './summary/SearchSummarySection';

export interface SearchListboxProps {
  records: SearchResponse | null;
  summary: SearchSummaryResponse | null;
  searchTerm: string;
  defaultFeatureTypeName: string;
  isLoading?: boolean;
}

/**
 * Search preview listbox for the root search page.
 *
 * Use this inside `SearchContainer` to show a keyboard-navigable mix of the raw
 * search query, summary counts, and detailed preview records. The component
 * owns navigation for selected rows so every item lands on the appropriate
 * feature-type result route with the current query preserved in URL params.
 *
 * @param {SearchListboxProps} props - Preview records, summary counts, current search term, and default feature route.
 * @returns {JSX.Element} Search preview listbox.
 */
export const SearchListbox = ({
  records,
  summary,
  searchTerm,
  defaultFeatureTypeName,
  isLoading = false
}: SearchListboxProps) => {
  const navigate = useNavigate();

  const navigateWithQuery = useCallback(
    (value: string | number, featureTypeName: string) => {
      const query = { [URL_PARAMS.SEARCH_QUERY]: value };
      const path = buildSearchFeatureTypePath(featureTypeName, query);

      navigate(path);
    },
    [navigate]
  );

  const hasResults = Boolean(searchTerm || summary || records);

  return (
    <Box
      sx={{
        p: 1,
        maxHeight: '50vh',
        overflowY: 'auto',
        borderRadius: 2,
        boxShadow: 1,
        backgroundColor: '#fff'
      }}>
      <LoadingGuard
        hasNoData={!hasResults}
        hasNoDataFallback={<Box p={2}>No results found</Box>}
        isLoading={isLoading}
        isLoadingFallback={<SkeletonList />}>
        <List disablePadding sx={{ p: 0 }} role="listbox" aria-label="Search results">
          {/* Search term at the top */}
          {searchTerm && (
            <ListItemButton
              role="option"
              onClick={() => navigateWithQuery(searchTerm, defaultFeatureTypeName)}
              data-search-item
              sx={{
                borderRadius: 1,
                '& .MuiListItemText-primary': {
                  color: (theme) => theme.palette.primary.main,
                  fontWeight: 500
                },
                bgcolor: grey[100],
                '&:hover': { bgcolor: grey[200] }
              }}>
              <ListItemIcon
                sx={{
                  color: (theme) => theme.palette.primary.main
                }}>
                <Icon path={mdiMagnify} size={1} style={{ display: 'block' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center">
                    <Box flex="1 1 auto">{`Search for "${searchTerm}"`}</Box>
                  </Box>
                }
                sx={{ m: 0 }}
              />
            </ListItemButton>
          )}

          {/* Summary results */}
          {summary && (
            <SearchSummarySection
              results={summary}
              searchTerm={searchTerm}
              defaultFeatureTypeName={defaultFeatureTypeName}
              onItemSelect={navigateWithQuery}
            />
          )}

          {/* Detailed records */}
          {records && (
            <SearchResultsSection
              results={records}
              defaultFeatureTypeName={defaultFeatureTypeName}
              onSelect={navigateWithQuery}
            />
          )}
        </List>
      </LoadingGuard>
    </Box>
  );
};

import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { grey } from '@mui/material/colors';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { URL_PARAMS } from 'constants/query-params';
import { SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { buildSearchFeatureTypePath } from 'utils/routes';
import { SearchSummarySection } from './summary/SearchSummarySection';

export interface SearchListboxProps {
  summary: SearchSummaryResponse | null;
  searchTerm: string;
  defaultFeatureTypeName: string;
  isLoading?: boolean;
}

/**
 * Search preview listbox for the root search page.
 *
 * Use this inside `SearchContainer` to show a keyboard-navigable list of the raw
 * search query and summary counts. The component
 * owns navigation for selected rows so every item lands on the appropriate
 * feature-type result route with the current query preserved in URL params.
 *
 * @param {SearchListboxProps} props - Summary counts, current search term, and default feature route.
 * @returns {JSX.Element} Search preview listbox.
 */
export const SearchListbox = ({
  summary,
  searchTerm,
  defaultFeatureTypeName,
  isLoading = false
}: SearchListboxProps) => {
  const navigate = useNavigate();

  const navigateWithQuery = useCallback(
    (value: string | number, featureTypeName?: string) => {
      const query = { [URL_PARAMS.SEARCH_QUERY]: searchTerm || value };
      const targetFeatureTypeName = featureTypeName ?? defaultFeatureTypeName;
      const path = buildSearchFeatureTypePath(targetFeatureTypeName, query);

      navigate(path);
    },
    [defaultFeatureTypeName, navigate, searchTerm]
  );

  const hasResults = Boolean(searchTerm || summary);

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
        </List>
      </LoadingGuard>
    </Box>
  );
};

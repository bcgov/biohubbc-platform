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
import { buildSearchQuery } from 'utils/search';
import { SearchResultsSection } from './record/SearchResultsSection';
import { SearchSummarySection } from './summary/SearchSummarySection';

export interface SearchListboxProps {
  records: SearchResponse | null;
  summary: SearchSummaryResponse | null;
  searchTerm: string;
  isLoading?: boolean;
  onItemSelect?: (value: string | number) => void;
}

export const SearchListbox = ({
  records,
  summary,
  searchTerm,
  isLoading = false,
  onItemSelect
}: SearchListboxProps) => {
  const navigate = useNavigate();

  const navigateWithQuery = useCallback(
    (value: string | number) => {
      navigate(
        buildSearchQuery('list', {
          [URL_PARAMS.SEARCH_QUERY]: value
        })
      );
      onItemSelect?.(value);
    },
    [navigate, onItemSelect]
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
              onClick={() => navigateWithQuery(searchTerm)}
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
          {summary && <SearchSummarySection results={summary} onItemSelect={navigateWithQuery} />}

          {/* Detailed records */}
          {records && (
            <SearchResultsSection
              results={records}
              onSubmissionSelect={navigateWithQuery}
              onTaxonomySelect={navigateWithQuery}
              onFeatureSelect={navigateWithQuery}
            />
          )}
        </List>
      </LoadingGuard>
    </Box>
  );
};

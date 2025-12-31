import { Box, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { SearchResultCardLayout } from '../../layout/list/SearchResultCardLayout';
import { SearchResultTableLayout } from '../../layout/table/SearchResultTableLayout';
import { SEARCH_RESULT_OPTION_VIEW } from '../../SearchResultPage';

interface SearchResultOptionsProps {
  rows: SearchFeatureResultWithRelevancy[];
  isLoading: boolean;
  view: SEARCH_RESULT_OPTION_VIEW;
}

export const SearchResultOptions = ({ rows, isLoading, view }: SearchResultOptionsProps) => {
  const hasResults = rows.length > 0;

  return (
    <LoadingGuard
      isLoading={isLoading}
      isLoadingFallback={<SkeletonList />}
      hasNoData={!hasResults}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography variant="h4" color="textSecondary">
            No results found
          </Typography>
        </Box>
      }>
      <ComponentSwitch<SEARCH_RESULT_OPTION_VIEW>
        switch={view}
        components={{
          table: <SearchResultTableLayout results={rows} onRowSelectionModelChange={() => {}} />,
          list: <SearchResultCardLayout results={rows} />
        }}
      />
    </LoadingGuard>
  );
};

import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Box } from '@mui/material';
import { grey } from '@mui/material/colors';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { URL_PARAMS } from 'constants/query-params';
import { SearchResponse, SearchSummaryResponse } from 'interfaces/useSearchApi.interface';
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import appTheme from 'themes/appTheme';
import { buildSearchQuery } from 'utils/search';
import { SearchOptionItem } from './components/SearchOptionItem';
import { SearchResultsSection } from './record/SearchResultsSection';
import { SearchSummarySection } from './summary/SearchSummarySection';

export interface SearchListboxProps {
  records: SearchResponse | null;
  summary: SearchSummaryResponse | null;
  searchTerm: string;
  isLoading?: boolean;
}

export const SearchListbox = ({ records, summary, searchTerm, isLoading = false }: SearchListboxProps) => {
  const navigate = useNavigate();
  const handleSummaryItemSelect = useCallback(
    (term: string) => {
      navigate(
        buildSearchQuery('list', {
          [URL_PARAMS.SEARCH_QUERY]: term
        })
      );
    },
    [navigate]
  );

  const handleViewMore = useCallback(() => {
    navigate(buildSearchQuery('list', {}));
  }, [navigate]);

  const handleSubmissionSelect = useCallback(
    (submissionId: number | string) => {
      navigate(
        buildSearchQuery('list', {
          [URL_PARAMS.SEARCH_QUERY]: submissionId
        })
      );
    },
    [navigate]
  );

  const handleTaxonomySelect = useCallback(
    (taxonId: number | string) => {
      navigate(
        buildSearchQuery('list', {
          [URL_PARAMS.SEARCH_QUERY]: taxonId
        })
      );
    },
    [navigate]
  );

  const handleFeatureSelect = useCallback(
    (featureId: number | string) => {
      navigate(
        buildSearchQuery('list', {
          [URL_PARAMS.SEARCH_QUERY]: featureId
        })
      );
    },
    [navigate]
  );

  const handleSearchEverything = useCallback(() => {
    navigate(
      buildSearchQuery('list', {
        [URL_PARAMS.SEARCH_QUERY]: searchTerm
      })
    );
  }, [navigate, searchTerm]);

  const hasResults = !!records || !!summary;

  return (
    <Box
      sx={{
        p: 1,
        maxHeight: '50vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        boxShadow: 1,
        backgroundColor: '#fff'
      }}>
      <LoadingGuard
        hasNoData={!hasResults}
        hasNoDataFallback={<Box p={2}>No results found</Box>}
        isLoading={isLoading}
        isLoadingFallback={<SkeletonList />}>
        <>
          {searchTerm && (
            <SearchOptionItem
              startIcon={<Icon path={mdiMagnify} size={1} style={{ display: 'block' }} />}
              name={`Search for "${searchTerm}"`}
              sx={{
                color: appTheme.palette.primary.light,
                bgcolor: grey[100],
                borderRadius: 1
              }}
              description={undefined}
              onSelect={handleSearchEverything}
            />
          )}
          {summary && <SearchSummarySection results={summary} onItemSelect={handleSummaryItemSelect} />}
          {records && (
            <SearchResultsSection
              results={records}
              onSubmissionSelect={handleSubmissionSelect}
              onTaxonomySelect={handleTaxonomySelect}
              onFeatureSelect={handleFeatureSelect}
              onViewMore={handleViewMore}
            />
          )}
        </>
      </LoadingGuard>
    </Box>
  );
};

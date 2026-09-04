import { mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Container, Divider } from '@mui/material';
import Button from '@mui/material/Button';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { PageSection } from 'components/section/PageSection';
import { ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { SEARCH_RESULT_VIEW } from 'constants/search';
import { FeatureTypeProperty } from 'interfaces/useCodesApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useState } from 'react';
import { ApiPaginationResponseParams } from 'types/pagination';
import { SearchResultOptions } from './option/SearchResultOptions';
import { SearchResultSortOption, SearchResultToolbar } from './toolbar/SearchResultToolbar';

export interface SearchResultContentProps {
  /** Search result rows returned by the feature search endpoint. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Feature type property metadata used to build table columns. */
  featureTypeProperties: FeatureTypeProperty[];
  /** Whether the result request is currently loading. */
  isLoading: boolean;
  /** Pagination metadata returned by the result request. */
  pagination: ApiPaginationResponseParams | undefined;
  /** Available sort buttons and their current directions. */
  sortOptions: SearchResultSortOption[];
  /** Field name for the currently active sort. */
  activeSort: string;
  /** Current result presentation mode. */
  view: SEARCH_RESULT_VIEW;
  /** Toggle-button options for switching result presentation modes. */
  viewOptions: ToggleButtonView<SEARCH_RESULT_VIEW>[];
  /** Updates the active sort field and direction. */
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
  /** Switches between available result views. */
  onViewChange: (view: SEARCH_RESULT_VIEW) => void;
  /** Opens the selected result. */
  onResultClick: (result: SearchFeatureResultWithRelevancy) => void;
  /** Updates the current result page. */
  onPageChange: (page: number) => void;
  /** Updates the result page size. */
  onPageSizeChange: (limit: number) => void;
  /** Map rendered when the map view is active. */
  mapContent?: React.ReactNode;
  /** Minimum height of the result viewport. */
  minHeight?: number;
  /** Vertical padding applied to the result toolbar. */
  toolbarPaddingY?: number;
}

interface SearchResultPanelProps extends SearchResultContentProps {
  /** Whether the create-download action is disabled. */
  isCreateDownloadDisabled: boolean;
  /** Opens the create-download flow for the current search. */
  onCreateDownloadClick: () => void;
}

/**
 * Renders the reusable search result toolbar, table or map viewport, and pagination.
 *
 * @param {SearchResultContentProps} props - Result data, presentation state, layout options, and action callbacks.
 * @returns {JSX.Element} Shared search result content without a surrounding page section.
 */
export const SearchResultContent = ({
  rows,
  featureTypeProperties,
  isLoading,
  pagination,
  sortOptions,
  activeSort,
  view,
  viewOptions,
  onSortChange,
  onViewChange,
  onResultClick,
  onPageChange,
  onPageSizeChange,
  mapContent,
  minHeight = 0,
  toolbarPaddingY = 1
}: SearchResultContentProps) => {
  const isMapView = view === SEARCH_RESULT_VIEW.MAP;
  const [hasOpenedMapView, setHasOpenedMapView] = useState(isMapView);

  // Mount the map on first use and keep it mounted so its session and viewport survive view changes.
  if (isMapView && !hasOpenedMapView) {
    setHasOpenedMapView(true);
  }

  return (
    <>
      <Box sx={{ px: 2, py: toolbarPaddingY }}>
        <SearchResultToolbar
          sortOptions={sortOptions}
          activeSort={activeSort}
          onSortChange={onSortChange}
          view={view}
          onViewChange={onViewChange}
          viewOptions={viewOptions}
        />
      </Box>

      <Divider />

      <Box
        data-testid="search-result-map-view"
        sx={{
          flex: 1,
          minHeight,
          overflow: 'hidden',
          display: isMapView ? 'flex' : 'none'
        }}>
        {hasOpenedMapView && mapContent}
      </Box>

      {!isMapView && (
        <Box sx={{ display: 'flex', flex: 1, minHeight, overflow: 'auto' }}>
          <SearchResultOptions
            rows={rows}
            featureTypeProperties={featureTypeProperties}
            isLoading={isLoading}
            view={view}
            onClick={onResultClick}
          />
        </Box>
      )}

      {!isMapView && (
        <>
          <Divider />
          <Box sx={{ px: 2, py: 1 }}>
            <CustomPagination
              currentPage={pagination?.current_page ?? 1}
              pageSize={pagination?.per_page ?? 10}
              totalCount={pagination?.total ?? 0}
              lastPage={pagination?.last_page ?? 1}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </Box>
        </>
      )}
    </>
  );
};

/**
 * Renders the search page's Results section around the reusable result content.
 *
 * @param {SearchResultPanelProps} props - Result content props and create-download action state.
 * @returns {JSX.Element} The complete search-page Results section.
 */
export const SearchResultPanel = ({
  isCreateDownloadDisabled,
  onCreateDownloadClick,
  ...contentProps
}: SearchResultPanelProps) => (
  <Container
    maxWidth="lg"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      py: 2,
      '& > .MuiPaper-root': {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0
      }
    }}>
    <PageSection
      id="search-results"
      label="Results"
      headerContent={
        <Button
          size="small"
          color="primary"
          onClick={onCreateDownloadClick}
          disabled={isCreateDownloadDisabled}
          startIcon={<Icon path={mdiDownload} size={0.8} />}
          sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
          Create Download
        </Button>
      }>
      <SearchResultContent {...contentProps} />
    </PageSection>
  </Container>
);

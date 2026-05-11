import { mdiBookmarkOutline, mdiDownload } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Container, Divider } from '@mui/material';
import Button from '@mui/material/Button';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { PageSection } from 'components/section/PageSection';
import { ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { SEARCH_RESULT_VIEW } from 'constants/search';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { ApiPaginationResponseParams } from 'types/pagination';
import { SearchResultOptions } from './option/SearchResultOptions';
import { SearchResultSortOption, SearchResultToolbar } from './toolbar/SearchResultToolbar';

interface SearchResultsSectionProps {
  /** Search result rows returned by the feature search endpoint. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Whether the result request is currently loading. */
  isLoading: boolean;
  /** Pagination metadata returned by the result request. Undefined while the first request is pending. */
  pagination: ApiPaginationResponseParams | undefined;
  /** Available sort buttons and their current directions. */
  sortOptions: SearchResultSortOption[];
  /** Field name for the currently active sort. */
  activeSort: string;
  /** Current result presentation mode. */
  view: SEARCH_RESULT_VIEW;
  /** Toggle-button options for switching result presentation modes. */
  viewOptions: ToggleButtonView<SEARCH_RESULT_VIEW>[];
  /** Whether the create-download action should be disabled. */
  isCreateDownloadDisabled: boolean;
  /** Adds the current page's result rows to the cart. */
  onAddAllToCart: () => void;
  /** Opens the create-download flow for the current search. */
  onCreateDownloadClick: () => void;
  /** Updates the URL-driven sort field and direction. */
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
  /** Switches between table and list result views. */
  onViewChange: (view: SEARCH_RESULT_VIEW) => void;
  /** Opens the selected result's feature detail page. */
  onResultClick: (result: SearchFeatureResultWithRelevancy) => void;
  /** Updates the current result page. */
  onPageChange: (page: number) => void;
  /** Updates the page size and resets to the first result page. */
  onPageSizeChange: (limit: number) => void;
}

/**
 * Renders the main search-results panel for the feature search page.
 *
 * Use this component inside `SearchResultPage` after route/search state has been
 * resolved. It owns only the result-panel layout: header actions, sort/view
 * toolbar, table/list result rendering, and pagination controls. Data loading,
 * navigation, cart mutation, and download mutation behavior are injected through
 * callbacks from the page-level hooks.
 *
 * @param {SearchResultsSectionProps} props - Result rows, pagination state, view/sort state, and action callbacks.
 * @returns {JSX.Element} Results section with toolbar, result list/table, and pagination.
 */
export const SearchResultsSection = ({
  rows,
  isLoading,
  pagination,
  sortOptions,
  activeSort,
  view,
  viewOptions,
  isCreateDownloadDisabled,
  onAddAllToCart,
  onCreateDownloadClick,
  onSortChange,
  onViewChange,
  onResultClick,
  onPageChange,
  onPageSizeChange
}: SearchResultsSectionProps) => {
  return (
    <Container maxWidth="md" sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, py: 2 }}>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
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
            <>
              <Button
                size="small"
                color="primary"
                onClick={onAddAllToCart}
                startIcon={<Icon path={mdiBookmarkOutline} size={0.8} />}
                sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
                Save
              </Button>
              <Button
                size="small"
                color="primary"
                onClick={onCreateDownloadClick}
                disabled={isCreateDownloadDisabled}
                startIcon={<Icon path={mdiDownload} size={0.8} />}
                sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
                Create Download
              </Button>
            </>
          }>
          <Box sx={{ px: 2, py: 1 }}>
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

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <SearchResultOptions rows={rows} isLoading={isLoading} view={view} onClick={onResultClick} />
          </Box>

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
        </PageSection>
      </Box>
    </Container>
  );
};

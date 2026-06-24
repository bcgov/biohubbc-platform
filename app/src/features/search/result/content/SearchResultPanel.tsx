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
import { ApiPaginationResponseParams } from 'types/pagination';
import { SearchResultOptions } from './option/SearchResultOptions';
import { SearchResultSortOption, SearchResultToolbar } from './toolbar/SearchResultToolbar';

interface SearchResultPanelProps {
  /** Search result rows returned by the feature search endpoint. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Feature type property metadata used to build table columns. */
  featureTypeProperties: FeatureTypeProperty[];
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
 * Renders the main result panel for the feature search page.
 *
 * Owns result-panel layout: header actions, sort/view toolbar, table/list
 * rendering, and pagination controls. Page-level hooks inject data loading,
 * navigation and download behavior.
 *
 * @param {SearchResultPanelProps} props - Result rows, pagination state, view/sort state, and action callbacks.
 * @returns {JSX.Element} Result panel with toolbar, result list/table, and pagination.
 */
export const SearchResultPanel = ({
  rows,
  featureTypeProperties,
  isLoading,
  pagination,
  sortOptions,
  activeSort,
  view,
  viewOptions,
  isCreateDownloadDisabled,
  onCreateDownloadClick,
  onSortChange,
  onViewChange,
  onResultClick,
  onPageChange,
  onPageSizeChange
}: SearchResultPanelProps) => {
  return (
    <Container
      maxWidth="md"
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
          <SearchResultOptions
            rows={rows}
            featureTypeProperties={featureTypeProperties}
            isLoading={isLoading}
            view={view}
            onClick={onResultClick}
          />
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
    </Container>
  );
};

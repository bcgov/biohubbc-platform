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
import { CursorPagination } from 'types/pagination';
import { SearchResultOptions } from './option/SearchResultOptions';
import { SearchResultSortOption, SearchResultToolbar } from './toolbar/SearchResultToolbar';

interface SearchResultPanelProps {
  /** Search result rows returned by the feature search endpoint. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Feature type property metadata used to build table columns. */
  featureTypeProperties: FeatureTypeProperty[];
  /** Whether the result request is currently loading. */
  isLoading: boolean;
  /** Cursor pagination state for the current result page. */
  cursor: CursorPagination;
  /** One-based page displayed in the pagination controls. */
  currentPage: number;
  /** Total matching rows from the separate count request, when resolved. */
  totalCount?: number;
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
  /**
   * Map view content, rendered in place of the table/list when the map view is active.
   *
   * A slot rather than another branch inside `SearchResultOptions`: the map's loading and empty states are driven by
   * its Martin session, not by the row count, and the page owns that session.
   *
   * Mounted on first use and kept mounted afterwards, so returning to the map does not rebuild it. The content is
   * expected to stand down while hidden; see `isActive` on `SearchResultMapContainer`.
   */
  mapContent?: React.ReactNode;
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
  cursor,
  currentPage,
  totalCount,
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
  onPageSizeChange,
  mapContent
}: SearchResultPanelProps) => {
  const isMapView = view === SEARCH_RESULT_VIEW.MAP;

  // The map is created the first time it is opened, and stays mounted from then on. Mounting it lazily keeps it out of
  // the way of users who never leave the table view, and means it is never built inside a hidden container: MapLibre
  // measures its container once, at construction, and a `display: none` container measures 0x0.
  const [hasOpenedMapView, setHasOpenedMapView] = useState(isMapView);

  if (isMapView && !hasOpenedMapView) {
    setHasOpenedMapView(true);
  }

  return (
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

        {/*
          The map is hidden with CSS rather than unmounted, so switching to the table and back leaves its session,
          viewport and loaded tiles as they were; unmounting would discard all three and re-request every tile on
          return. The table has no such state to lose and stays conditional.
        */}
        <Box
          data-testid="search-result-map-view"
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            display: isMapView ? 'flex' : 'none'
          }}>
          {hasOpenedMapView && mapContent}
        </Box>

        {!isMapView && (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}>
            <SearchResultOptions
              rows={rows}
              featureTypeProperties={featureTypeProperties}
              isLoading={isLoading}
              view={view}
              onClick={onResultClick}
            />
          </Box>
        )}

        {/* The map shows the whole result set at once, so paging through it would be meaningless. */}
        {!isMapView && (
          <>
            <Divider />

            <Box sx={{ px: 2, py: 1 }}>
              <CustomPagination
                cursor={cursor}
                currentPage={currentPage}
                rowCount={rows.length}
                totalCount={totalCount}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            </Box>
          </>
        )}
      </PageSection>
    </Container>
  );
};

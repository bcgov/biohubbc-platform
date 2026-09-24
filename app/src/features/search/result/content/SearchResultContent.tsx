import { Box, Divider } from '@mui/material';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { ToggleButtonView } from 'components/toggle-button/ToggleButtons';
import { SEARCH_RESULT_VIEW } from 'constants/search';
import { SearchFeatureProperty, SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { useState } from 'react';
import { CursorPagination } from 'types/pagination';
import { type SubmissionPropertyValuePathResolvers } from 'utils/routes.interface';
import { SearchResultOptions } from './option/SearchResultOptions';
import { SearchResultSortOption, SearchResultToolbar } from './toolbar/SearchResultToolbar';

export interface SearchResultContentProps {
  /** Search result rows returned by the feature search endpoint. */
  rows: SearchFeatureResultWithRelevancy[];
  /** Feature type property metadata used to build table columns. */
  featureTypeProperties: SearchFeatureProperty[];
  /** Path resolvers for handling redirects when clicking hyperlinked feature values. */
  pathResolvers: SubmissionPropertyValuePathResolvers;
  /** Whether the result request is currently loading. */
  isLoading: boolean;
  /** Pagination metadata returned by the result request. */
  cursor: CursorPagination;
  /** Total matching rows from the separate count request. */
  totalCount?: number;
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
  onPageChange: (cursor: string) => void;
  /** Updates the result page size. */
  onPageSizeChange: (limit: number) => void;
  /** Map rendered when the map view is active. */
  mapContent?: React.ReactNode;
  /** Minimum height of the result viewport. */
  minHeight?: number;
  /** Vertical padding applied to the result toolbar. */
  toolbarPaddingY?: number;
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
  pathResolvers,
  isLoading,
  cursor,
  totalCount,
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
            pathResolvers={pathResolvers}
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
              cursor={cursor}
              rowCount={rows.length}
              totalCount={totalCount}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </Box>
        </>
      )}
    </>
  );
};

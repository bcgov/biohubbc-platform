import { Box, Stack } from '@mui/material';
import { SortButton } from 'components/button/SortButton';
import { ToggleButtonView, ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { SEARCH_RESULT_VIEW } from 'constants/search';

/**
 * Sort button configuration consumed by the search result toolbar and produced
 * by `useSearchResultPagingSort`.
 *
 * Shared label/value/direction contract for result-toolbar sort options.
 */
export interface SearchResultSortOption {
  /** Human-readable sort label shown in the toolbar. */
  label: string;
  /** API/URL sort field value. */
  value: string;
  /** Current direction for this sort field. */
  direction: 'asc' | 'desc';
}

interface SearchResultToolbarProps {
  /** Sort controls shown at the start of the result toolbar. */
  sortOptions: SearchResultSortOption[];
  /** API/URL sort field currently selected by the user. */
  activeSort: string;
  /** Applies the next sort field and direction to the URL-driven result query. */
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
  /** Current result presentation mode. */
  view: SEARCH_RESULT_VIEW;
  /** Switches between available result presentation modes. */
  onViewChange: (view: SEARCH_RESULT_VIEW) => void;
  /** View toggle definitions shown at the end of the result toolbar. */
  viewOptions: ToggleButtonView<SEARCH_RESULT_VIEW>[];
}

/**
 * Renders sort and view controls for the search result panel.
 *
 * Layout-only result controls. Callers own URL updates and view state changes.
 *
 * @param {SearchResultToolbarProps} props - Sort state, view state, and control callbacks.
 * @returns {JSX.Element} Compact result toolbar.
 */
export const SearchResultToolbar = ({
  sortOptions,
  activeSort,
  onSortChange,
  view,
  onViewChange,
  viewOptions
}: SearchResultToolbarProps) => {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {sortOptions.map((opt) => {
          const isActive = activeSort === opt.value;
          const newDirection = opt.direction === 'asc' ? 'desc' : 'asc';
          return (
            <SortButton
              key={opt.value}
              direction={opt.direction}
              selected={isActive}
              onClick={() => {
                const nextDirection = isActive ? newDirection : 'desc';
                onSortChange(opt.value, nextDirection);
              }}>
              {opt.label}
            </SortButton>
          );
        })}
      </Box>

      <ToggleButtons views={viewOptions} activeView={view} onViewChange={onViewChange} orientation="horizontal" />
    </Stack>
  );
};

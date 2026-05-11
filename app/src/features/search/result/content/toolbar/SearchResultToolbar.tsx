import { Stack } from '@mui/material';
import { SortButton } from 'components/button/SortButton';
import { ToggleButtonView, ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { SEARCH_RESULT_VIEW } from 'constants/search';

/**
 * Sort button configuration consumed by the search result toolbar and produced
 * by `useSearchResultPagingSort`.
 *
 * Use this type anywhere result-toolbar sort options are passed between
 * search-result hooks and presentational components so all callers share the
 * same label/value/direction contract.
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
  sortOptions: SearchResultSortOption[];
  activeSort: string;
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
  view: SEARCH_RESULT_VIEW;
  onViewChange: (view: SEARCH_RESULT_VIEW) => void;
  viewOptions: ToggleButtonView<SEARCH_RESULT_VIEW>[];
}

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
      <Stack direction="row" alignItems="center" spacing={1}>
        <Stack direction="row" spacing={0.5}>
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
        </Stack>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1}>
        <ToggleButtons views={viewOptions} activeView={view} onViewChange={onViewChange} orientation="horizontal" />
      </Stack>
    </Stack>
  );
};

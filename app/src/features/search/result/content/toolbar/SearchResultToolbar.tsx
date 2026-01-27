import { Stack } from '@mui/material';
import { SortButton } from 'components/button/SortButton';
import { ToggleButtonView, ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { SEARCH_RESULT_OPTION_VIEW } from '../../SearchResultPage';

interface SortOption {
  label: string;
  value: string;
  direction: 'asc' | 'desc';
}

interface SearchResultToolbarProps {
  view: SEARCH_RESULT_OPTION_VIEW;
  onViewChange: (view: SEARCH_RESULT_OPTION_VIEW) => void;

  sortOptions: SortOption[];
  activeSort: string;
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;

  viewOptions?: ToggleButtonView<SEARCH_RESULT_OPTION_VIEW>[];
}

export const SearchResultToolbar = ({
  view,
  onViewChange,
  sortOptions,
  activeSort,
  onSortChange,
  viewOptions
}: SearchResultToolbarProps) => {
  const defaultViews: ToggleButtonView<SEARCH_RESULT_OPTION_VIEW>[] = [
    { value: SEARCH_RESULT_OPTION_VIEW.TABLE, label: 'Table' },
    { value: SEARCH_RESULT_OPTION_VIEW.LIST, label: 'List' }
  ];

  const toggleViews = viewOptions ?? defaultViews;

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
      {/* Left: Sort */}
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

      {/* Right: View */}
      <ToggleButtons views={toggleViews} activeView={view} onViewChange={onViewChange} orientation="horizontal" />
    </Stack>
  );
};

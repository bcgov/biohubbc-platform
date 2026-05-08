import { mdiDownload, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Stack } from '@mui/material';
import { SortButton } from 'components/button/SortButton';
import { ToggleButtonView, ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
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
  onAddAllToCart: () => void;
  onCreateDownloadClick: () => void;
  isCreateDownloadDisabled?: boolean;
}

export const SearchResultToolbar = ({
  view,
  onViewChange,
  sortOptions,
  activeSort,
  onSortChange,
  viewOptions,
  onAddAllToCart,
  onCreateDownloadClick,
  isCreateDownloadDisabled
}: SearchResultToolbarProps) => {
  // Create Download requires authentication — anonymous downloads are deprecated and will be
  // re-introduced via curated download packages.
  const { auth } = useAuthStateContext();

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

      {/* Right: Actions + View */}
      <Stack direction="row" alignItems="center" spacing={1}>
        {auth.isAuthenticated && (
          <Button
            size="small"
            color="primary"
            onClick={onCreateDownloadClick}
            disabled={isCreateDownloadDisabled}
            startIcon={<Icon path={mdiDownload} size={0.8} />}
            sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
            Create Download
          </Button>
        )}
        <Button
          size="small"
          color="primary"
          onClick={onAddAllToCart}
          startIcon={<Icon path={mdiPlus} size={0.8} />}
          sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
          Add All to Cart
        </Button>
        <ToggleButtons views={toggleViews} activeView={view} onViewChange={onViewChange} orientation="horizontal" />
      </Stack>
    </Stack>
  );
};

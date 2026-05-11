import { mdiDownload, mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import { Button, Stack } from '@mui/material';
import { SortButton } from 'components/button/SortButton';

interface SortOption {
  label: string;
  value: string;
  direction: 'asc' | 'desc';
}

interface SearchResultToolbarProps {
  sortOptions: SortOption[];
  activeSort: string;
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
  onAddAllToCart: () => void;
  onCreateDownloadClick: () => void;
  isCreateDownloadDisabled?: boolean;
}

export const SearchResultToolbar = ({
  sortOptions,
  activeSort,
  onSortChange,
  onAddAllToCart,
  onCreateDownloadClick,
  isCreateDownloadDisabled
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
        <Button
          size="small"
          color="primary"
          onClick={onCreateDownloadClick}
          disabled={isCreateDownloadDisabled}
          startIcon={<Icon path={mdiDownload} size={0.8} />}
          sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
          Create Download
        </Button>
        <Button
          size="small"
          color="primary"
          onClick={onAddAllToCart}
          startIcon={<Icon path={mdiPlus} size={0.8} />}
          sx={{ flexWrap: 'nowrap', fontWeight: 700 }}>
          Add All to Cart
        </Button>
      </Stack>
    </Stack>
  );
};

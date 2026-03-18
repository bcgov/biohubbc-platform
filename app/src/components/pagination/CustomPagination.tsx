import { MenuItem, Pagination as MuiPagination, Select, SelectChangeEvent, Stack, Typography } from '@mui/material';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface CustomPaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export const CustomPagination = ({
  currentPage,
  pageSize,
  totalCount,
  lastPage,
  onPageChange,
  onPageSizeChange
}: CustomPaginationProps) => {
  const firstItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalCount);

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    onPageSizeChange(Number(event.target.value));
  };

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="nowrap">
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" color="text.secondary">
          {firstItem}–{lastItem} of {totalCount}
        </Typography>
        <Select<number>
          size="small"
          value={pageSize}
          onChange={handlePageSizeChange}
          inputProps={{ 'aria-label': 'rows per page' }}
          sx={{ fontSize: '0.875rem' }}>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </Stack>

      <MuiPagination
        count={lastPage}
        page={currentPage}
        onChange={(_event, page) => onPageChange(page)}
        shape="rounded"
        siblingCount={0}
        boundaryCount={0}
      />
    </Stack>
  );
};

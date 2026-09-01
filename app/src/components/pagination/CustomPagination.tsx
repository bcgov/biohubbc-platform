import { MenuItem, PaginationItem, Select, SelectChangeEvent, Stack, Typography } from '@mui/material';
import { PAGE_SIZE_OPTIONS } from 'constants/pagination';
import { getPaginationItems } from 'utils/pagination';

interface CustomPaginationProps {
  /** One-based active page number. */
  currentPage: number;
  /** Number of rows displayed per page. */
  pageSize: number;
  /** Total number of rows across every page. */
  totalCount: number;
  /** One-based final page number. */
  lastPage: number;
  /** Applies a new one-based page number. */
  onPageChange: (page: number) => void;
  /** Applies a new row count per page. */
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Renders a compact pagination footer with result count, page-size selection,
 * previous/next controls, and a bounded page-number window.
 *
 * @param {CustomPaginationProps} props - Current pagination state and change handlers.
 * @returns {JSX.Element} Pagination footer for server-backed result lists.
 */
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
  const paginationItems = getPaginationItems(currentPage, lastPage);

  /**
   * Handles row-count selection changes from the page-size dropdown.
   *
   * @param {SelectChangeEvent<number>} event - MUI select change event containing the selected page size.
   * @returns {void}
   */
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

      <Stack component="nav" aria-label="pagination navigation" direction="row" alignItems="center">
        <PaginationItem
          type="previous"
          shape="rounded"
          aria-label="Go to previous page"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        />

        {paginationItems.map((item) =>
          typeof item === 'number' ? (
            <PaginationItem
              key={item}
              type="page"
              page={item}
              selected={item === currentPage}
              shape="rounded"
              aria-label={item === currentPage ? `page ${item}` : `Go to page ${item}`}
              onClick={() => onPageChange(item)}
            />
          ) : (
            <PaginationItem key={item} type={item} shape="rounded" />
          )
        )}

        <PaginationItem
          type="next"
          shape="rounded"
          aria-label="Go to next page"
          disabled={currentPage >= lastPage}
          onClick={() => onPageChange(currentPage + 1)}
        />
      </Stack>
    </Stack>
  );
};

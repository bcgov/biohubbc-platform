import { MenuItem, PaginationItem, Select, SelectChangeEvent, Stack, Typography } from '@mui/material';
import { PAGE_SIZE_OPTIONS } from 'constants/pagination';
import { CursorPagination } from 'types/pagination';

interface CustomPaginationProps {
  /** Cursor pagination state for the current result page. */
  cursor: CursorPagination;
  /** One-based page displayed to the user. */
  currentPage: number;
  /** Number of rows displayed on the current page. */
  rowCount: number;
  /** Total number of matching rows from the separate count request. */
  totalCount?: number;
  /** Applies a new one-based page number. */
  onPageChange: (page: number) => void;
  /** Applies a new row count per page. */
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Renders a compact pagination footer with result count, page-size selection,
 * previous/next controls, and the current page label.
 *
 * @param {CustomPaginationProps} props - Current pagination state and change handlers.
 * @returns {JSX.Element} Pagination footer for server-backed result lists.
 */
export const CustomPagination = ({
  cursor,
  currentPage,
  rowCount,
  totalCount,
  onPageChange,
  onPageSizeChange
}: CustomPaginationProps) => {
  const lastPage = totalCount === undefined ? undefined : Math.max(1, Math.ceil(totalCount / cursor.limit));

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
          Showing {rowCount}
          {totalCount !== undefined && ` of ${totalCount}`} {rowCount === 1 ? 'row' : 'rows'}
        </Typography>
        <Select<number>
          size="small"
          value={cursor.limit}
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
          disabled={!cursor.previous}
          onClick={() => onPageChange(currentPage - 1)}
        />

        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          Page {currentPage}
          {lastPage !== undefined && ` of ${lastPage}`}
        </Typography>

        <PaginationItem
          type="next"
          shape="rounded"
          aria-label="Go to next page"
          disabled={!cursor.next}
          onClick={() => onPageChange(currentPage + 1)}
        />
      </Stack>
    </Stack>
  );
};

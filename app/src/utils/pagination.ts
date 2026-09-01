import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { PAGE_WINDOW_SIZE } from 'constants/pagination';
import { ApiPaginationRequestOptions } from 'types/pagination';

export type PaginationPageItem = number | 'start-ellipsis' | 'end-ellipsis';

/**
 * Converts DataGrid-style pagination/sort state into API pagination options.
 *
 * @param {GridPaginationModel} paginationModel - Zero-based MUI DataGrid pagination model.
 * @param {GridSortModel} sortModel - MUI DataGrid sort model.
 * @returns {ApiPaginationRequestOptions} One-based API pagination options with optional sort metadata.
 */
export const toApiPagination = (
  paginationModel: GridPaginationModel,
  sortModel: GridSortModel
): ApiPaginationRequestOptions => {
  const sort = sortModel[0];

  return {
    page: paginationModel.page + 1,
    limit: paginationModel.pageSize,
    sort: sort?.field,
    order: sort?.sort ?? undefined
  };
};

/**
 * Builds an inclusive number range.
 *
 * @param {number} start - First value in the range.
 * @param {number} end - Last value in the range.
 * @returns {number[]} Ordered list of numbers from `start` through `end`.
 */
export const range = (start: number, end: number): number[] => {
  return Array.from({ length: end - start + 1 }, (_value, index) => start + index);
};

/**
 * Builds the compact pagination item sequence.
 *
 * The sequence keeps a fixed-size page window near the current page, includes
 * the first page when the window is not already at the start, and always includes
 * the final page so the control never ends with an ellipsis.
 *
 * @param {number} currentPage - One-based active page number.
 * @param {number} lastPage - One-based final page number.
 * @returns {PaginationPageItem[]} Page numbers and ellipsis markers to render.
 */
export const getPaginationItems = (currentPage: number, lastPage: number): PaginationPageItem[] => {
  if (lastPage <= PAGE_WINDOW_SIZE + 1) {
    return range(1, lastPage);
  }

  const windowStart = Math.min(Math.max(currentPage - 2, 1), lastPage - PAGE_WINDOW_SIZE + 1);
  const windowEnd = windowStart + PAGE_WINDOW_SIZE - 1;
  const items: PaginationPageItem[] = [];

  if (windowStart > 1) {
    items.push(1);

    if (windowStart > 2) {
      items.push('start-ellipsis');
    }
  }

  items.push(...range(windowStart, windowEnd));

  if (windowEnd < lastPage) {
    if (windowEnd < lastPage - 1) {
      items.push('end-ellipsis');
    }

    items.push(lastPage);
  }

  return items;
};

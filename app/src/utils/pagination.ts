import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { URL_PARAMS } from 'constants/query-params';
import { ApiCursorPaginationRequestOptions, ApiPaginationRequestOptions } from 'types/pagination';

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
 * Converts URL search parameters into cursor-pagination API options.
 *
 * The cursor is read with the native `URLSearchParams` implementation so its
 * opaque, case-sensitive value is preserved even when a normalized parameter
 * wrapper is supplied.
 *
 * @param {URLSearchParams} params - URL parameters containing cursor-pagination state.
 * @returns {ApiCursorPaginationRequestOptions} API options for the current cursor page.
 */
export const toApiCursorPagination = (params: URLSearchParams): ApiCursorPaginationRequestOptions => {
  const cursor = URLSearchParams.prototype.get.call(params, URL_PARAMS.CURSOR) as string | null;

  return {
    limit: Number(params.get(URL_PARAMS.LIMIT) ?? 10),
    sort: params.get(URL_PARAMS.SORT) ?? undefined,
    order: (params.get(URL_PARAMS.ORDER) as 'asc' | 'desc') ?? undefined,
    cursor: cursor ?? undefined
  };
};

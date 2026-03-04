import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Converts DataGrid-style pagination/sort state into API pagination options.
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

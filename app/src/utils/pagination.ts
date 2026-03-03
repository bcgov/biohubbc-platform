import { ApiPaginationRequestOptions } from 'types/pagination';

export interface IDataGridPaginationModelLike {
  page: number;
  pageSize: number;
}

export interface IDataGridSortModelItemLike {
  field: string;
  sort?: 'asc' | 'desc' | null;
}

/**
 * Converts DataGrid-style pagination/sort state into API pagination options.
 */
export const toApiPagination = (
  paginationModel: IDataGridPaginationModelLike,
  sortModel: ReadonlyArray<IDataGridSortModelItemLike>
): ApiPaginationRequestOptions => {
  const sort = sortModel[0];

  return {
    page: paginationModel.page + 1,
    limit: paginationModel.pageSize,
    sort: sort?.field,
    order: sort?.sort ?? undefined
  };
};

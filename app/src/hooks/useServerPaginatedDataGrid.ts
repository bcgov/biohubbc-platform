import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useCallback, useEffect, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { toApiPagination } from 'utils/pagination';
import useDataLoader from './useDataLoader';
import useDebounce from './useDebounce';

/**
 * Configuration options for the useServerPaginatedDataGrid hook.
 */
export interface IUseServerPaginatedDataGridOptions<TData, TResponse> {
  /** Function to fetch data from the API */
  fetcher: (search: string, pagination: ApiPaginationRequestOptions) => Promise<TResponse>;
  /** Function to extract the data array from the API response */
  extractData: (response: TResponse) => TData[];
  /** Function to extract the total count from the API response */
  extractTotal: (response: TResponse) => number;
  /** Default sort configuration */
  defaultSort: { field: string; sort: 'asc' | 'desc' };
  /** Default page size */
  defaultPageSize?: number;
  /** Debounce delay in ms for search */
  debounceMs?: number;
}

/**
 * Return type for the useServerPaginatedDataGrid hook.
 */
export interface IUseServerPaginatedDataGridReturn<TData, TResponse> {
  /** Raw server response */
  response: TResponse | undefined;
  /** Extracted rows from server response data */
  rows: TData[];
  /** Total row count for server-side pagination */
  rowCount: number;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Current pagination model (for DataGrid) */
  paginationModel: GridPaginationModel;
  /** Handler for pagination changes (pass to DataGrid onPaginationModelChange) */
  handlePaginationChange: (model: GridPaginationModel) => void;
  /** Current sort model (for DataGrid) */
  sortModel: GridSortModel;
  /** Handler for sort changes (pass to DataGrid onSortModelChange) */
  handleSortChange: (model: GridSortModel) => void;
  /** Current search term (for controlled input) */
  searchTerm: string;
  /** Handler for search input changes */
  handleSearch: (term: string) => void;
  /** Refresh data with current params */
  refresh: () => void;
  /** Directly replace the raw server response */
  setData: (data: TResponse) => void;
}

/**
 * Custom hook for server-side paginated DataGrid with search and sort.
 *
 * Encapsulates pagination, sorting, and debounced search state management
 * for MUI DataGrid with server-side data fetching.
 *
 * @example
 * ```tsx
 * const policies = useServerPaginatedDataGrid({
 *   fetcher: (search, pagination) => biohubApi.policies.getPolicies({ search }, pagination),
 *   extractData: (response) => response.policies,
 *   extractTotal: (response) => response.pagination.total,
 *   defaultSort: { field: 'name', sort: 'asc' }
 * });
 *
 * <DataGrid
 *   rows={policies.data}
 *   rowCount={policies.rowCount}
 *   paginationModel={policies.paginationModel}
 *   onPaginationModelChange={policies.handlePaginationChange}
 *   sortModel={policies.sortModel}
 *   onSortModelChange={policies.handleSortChange}
 *   paginationMode="server"
 *   sortingMode="server"
 * />
 * ```
 */
export const useServerPaginatedDataGrid = <TData, TResponse>(
  options: IUseServerPaginatedDataGridOptions<TData, TResponse>
): IUseServerPaginatedDataGridReturn<TData, TResponse> => {
  const { fetcher, extractData, extractTotal, defaultSort, defaultPageSize = 10, debounceMs = 300 } = options;

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: defaultPageSize });
  const [sortModel, setSortModel] = useState<GridSortModel>([defaultSort]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Data loader
  const dataLoader = useDataLoader((search: string, pagination: ApiPaginationRequestOptions) =>
    fetcher(search, pagination)
  );

  // Load data on mount
  useEffect(() => {
    const apiPagination = toApiPagination(paginationModel, sortModel);
    dataLoader.load(debouncedSearchTerm, apiPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search - resets to page 1 and fetches
  // Using useDebounce ensures stable function identity while always seeing latest state
  const debouncedRefresh = useDebounce((term: string) => {
    setDebouncedSearchTerm(term);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    const apiPagination = toApiPagination(paginationModel, sortModel);
    dataLoader.refresh(term, {
      ...apiPagination,
      page: 1
    });
  }, debounceMs);

  // Search handler - updates input immediately, debounces API call
  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      debouncedRefresh(term);
    },
    [debouncedRefresh]
  );

  // Pagination handler - immediate fetch
  const handlePaginationChange = useCallback(
    (model: GridPaginationModel) => {
      setPaginationModel(model);
      const apiPagination = toApiPagination(model, sortModel);
      dataLoader.refresh(debouncedSearchTerm, apiPagination);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortModel, debouncedSearchTerm]
  );

  // Sort handler - immediate fetch
  const handleSortChange = useCallback(
    (model: GridSortModel) => {
      setSortModel(model);
      const apiPagination = toApiPagination(paginationModel, model);
      dataLoader.refresh(debouncedSearchTerm, apiPagination);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paginationModel, debouncedSearchTerm]
  );

  // Manual refresh with current params
  const refresh = useCallback(() => {
    const apiPagination = toApiPagination(paginationModel, sortModel);
    dataLoader.refresh(debouncedSearchTerm, apiPagination);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, paginationModel, sortModel]);

  const rows = dataLoader.data ? extractData(dataLoader.data) : [];
  const rowCount = dataLoader.data ? extractTotal(dataLoader.data) : 0;

  return {
    response: dataLoader.data,
    rows,
    rowCount,
    isLoading: dataLoader.isLoading,
    paginationModel,
    handlePaginationChange,
    sortModel,
    handleSortChange,
    searchTerm,
    handleSearch,
    refresh,
    setData: dataLoader.setData
  };
};

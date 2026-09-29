import { GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { toApiPagination } from 'utils/pagination';
import useDebounce from './useDebounce';

/**
 * Configuration options for the useServerPaginatedGridState hook.
 */
export interface IUseServerPaginatedGridStateOptions {
  /** Sort applied before the user picks one. */
  defaultSort: { field: string; sort: 'asc' | 'desc' };
  /** Rows per page before the user picks a size. */
  defaultPageSize?: number;
  /** Delay in ms between the last keystroke and the search term being applied. */
  debounceMs?: number;
}

/**
 * Local UI state for a server-paginated DataGrid.
 */
export interface IServerPaginatedGridState {
  /** Current zero-based pagination model (for DataGrid). */
  paginationModel: GridPaginationModel;
  /** Handler for pagination changes (pass to DataGrid onPaginationModelChange). */
  handlePaginationChange: (model: GridPaginationModel) => void;
  /** Current sort model (for DataGrid). */
  sortModel: GridSortModel;
  /** Handler for sort changes (pass to DataGrid onSortModelChange). */
  handleSortChange: (model: GridSortModel) => void;
  /** Search input value, updated on every keystroke. */
  searchTerm: string;
  /** Search term once typing has settled; the value a query key should carry. */
  debouncedSearchTerm: string;
  /** Handler for search input changes. */
  handleSearch: (term: string) => void;
  /** One-based API pagination derived from the pagination and sort models; the value a query key should carry. */
  apiPagination: ApiPaginationRequestOptions;
}

/**
 * Holds the pagination, sort and search state of a server-paginated DataGrid.
 *
 * The hook fetches nothing: the consumer puts `debouncedSearchTerm` and `apiPagination` in its query key, so
 * any change to them loads the matching page. Applying a new search term returns the grid to its first page
 * in the same update, so a search produces one request.
 *
 * @example
 * ```tsx
 * const grid = useServerPaginatedGridState({ defaultSort: { field: 'name', sort: 'asc' } });
 * const policiesQuery = useQuery({
 *   queryKey: policyQueryKeys.list(grid.debouncedSearchTerm, grid.apiPagination),
 *   queryFn: ({ signal }) => api.policies.getPolicies({ search: grid.debouncedSearchTerm }, grid.apiPagination, { signal }),
 *   placeholderData: keepPreviousData
 * });
 * ```
 *
 * @param {IUseServerPaginatedGridStateOptions} options Default sort, page size and search debounce.
 * @returns {IServerPaginatedGridState} Grid models, their handlers, and the values a query key should carry.
 */
export const useServerPaginatedGridState = (
  options: IUseServerPaginatedGridStateOptions
): IServerPaginatedGridState => {
  const { defaultSort, defaultPageSize = 10, debounceMs = 300 } = options;

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: defaultPageSize });
  const [sortModel, setSortModel] = useState<GridSortModel>([defaultSort]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const applySearch = useDebounce((term: string) => {
    setDebouncedSearchTerm(term);
    setPaginationModel((previous) => ({ ...previous, page: 0 }));
  }, debounceMs);

  useEffect(() => () => applySearch.cancel(), [applySearch]);

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      applySearch(term);
    },
    [applySearch]
  );

  const handlePaginationChange = useCallback((model: GridPaginationModel) => setPaginationModel(model), []);

  const handleSortChange = useCallback((model: GridSortModel) => setSortModel(model), []);

  const apiPagination = useMemo(() => toApiPagination(paginationModel, sortModel), [paginationModel, sortModel]);

  return {
    paginationModel,
    handlePaginationChange,
    sortModel,
    handleSortChange,
    searchTerm,
    debouncedSearchTerm,
    handleSearch,
    apiPagination
  };
};

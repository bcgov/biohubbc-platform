/**
 * Defines the supported search parameters for API requests.
 */
export interface ApiSearchParams {
  search?: string;
}

/**
 * Defines the supported server-side pagination options.
 */
export type ApiPaginationRequestOptions = {
  /**
   * The page number to retrieve. Starts at 1.
   *
   * @type {number}
   */
  page: number;
  /**
   * The number of items to retrieve per page.
   *
   * @type {number}
   */
  limit: number;
  /**
   * The field to sort by.
   *
   * @type {string}
   */
  sort?: string;
  /**
   * The direction to sort by.
   *
   * @type {('asc' | 'desc')}
   */
  order?: 'asc' | 'desc';
};

/**
 * Represents server-side pagination state given by the server
 */
export type ApiPaginationResponseParams = {
  total: number;
  current_page: number;
  last_page: number;
  per_page?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

/**
 * Props for components using MUI DataGrid with server-side pagination.
 * Components should extend this interface for their props.
 */
export interface IServerPaginationProps {
  /** Total number of rows (for server-side pagination) */
  rowCount: number;
  /** Current pagination model from parent */
  paginationModel: import('@mui/x-data-grid').GridPaginationModel;
  /** Callback when pagination changes */
  setPaginationModel: (model: import('@mui/x-data-grid').GridPaginationModel) => void;
  /** Current sort model from parent */
  sortModel: import('@mui/x-data-grid').GridSortModel;
  /** Callback when sort changes */
  setSortModel: (model: import('@mui/x-data-grid').GridSortModel) => void;
}

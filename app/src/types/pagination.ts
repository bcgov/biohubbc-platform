/**
 * Defines the supported search parameters for API requests.
 */
export interface ApiSearchParams {
  search?: string;
}

/** Sorting shared by offset- and cursor-paginated requests. */
export interface PaginationSorting {
  /** The field to sort by. */
  sort?: string;
  /** The direction to sort by. */
  order?: 'asc' | 'desc';
}

/**
 * Defines the supported server-side pagination options.
 */
export interface ApiPaginationRequestOptions extends PaginationSorting {
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
}

/**
 * Defines the supported cursor-pagination options for API requests.
 */
export interface ApiCursorPaginationRequestOptions extends PaginationSorting {
  /** The number of items to retrieve per page. */
  limit: number;
  /** Opaque cursor returned by an adjacent page. */
  cursor?: string;
}

/**
 * Represents server-side pagination state given by the server
 */
export interface ApiPaginationResponseParams extends PaginationSorting {
  total: number;
  current_page: number;
  last_page: number;
  per_page?: number;
}

/**
 * Represents cursor-pagination state returned by the server.
 */
export interface ApiCursorResponseParams extends PaginationSorting {
  limit: number;
  sort: string;
  order: 'asc' | 'desc';
  next_cursor: string | null;
  previous_cursor: string | null;
}

/** URL and response state used to navigate a cursor-paginated result set. */
export interface CursorPagination extends PaginationSorting {
  /** Maximum number of rows requested for each page. */
  limit: number;
  /** Opaque cursor for the following page. */
  next: string | null;
  /** Opaque cursor for the preceding page. */
  previous: string | null;
}

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

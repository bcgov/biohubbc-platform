import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CursorPagination } from 'types/pagination';
import { type SearchResultSortOption } from '../content/toolbar/SearchResultToolbar';

interface UseSearchResultPagingSortProps {
  /** Cursor pagination state for the current result page. */
  cursor: CursorPagination;
  /** One-based page stored in the URL for display and browser history. */
  currentPage: number;
  /** URL-aware search parameter setter from `useSearchResults`. */
  setSearchParams: (params: Partial<Record<UrlParamKey, string>>, replace?: boolean) => void;
}

/**
 * Derives sort controls and pagination handlers for search results.
 *
 * Derives toolbar sort options and URL-backed paging callbacks from result
 * pagination metadata.
 *
 * @param {UseSearchResultPagingSortProps} props - Current pagination metadata and URL-aware search-param setter.
 * @returns Active sort field, toolbar sort options, and handlers for sort, page, and page-size changes.
 */
export const useSearchResultPagingSort = ({ cursor, currentPage, setSearchParams }: UseSearchResultPagingSortProps) => {
  const serverSort = cursor.sort ?? 'relevancy_score';
  const serverOrder = cursor.order ?? 'desc';
  const [optimisticSort, setOptimisticSort] = useState({ sort: serverSort, order: serverOrder });

  useEffect(() => {
    setOptimisticSort({ sort: serverSort, order: serverOrder });
  }, [serverSort, serverOrder]);

  const activeSort = optimisticSort.sort;
  const sortOrder = optimisticSort.order;

  const sortOptions = useMemo<SearchResultSortOption[]>(
    () => [
      {
        label: 'Relevance',
        value: 'relevancy_score',
        direction: activeSort === 'relevancy_score' ? sortOrder : 'desc'
      },
      { label: 'Date', value: 'create_date', direction: activeSort === 'create_date' ? sortOrder : 'desc' }
    ],
    [activeSort, sortOrder]
  );

  /**
   * Applies a new sort field and direction to the URL-backed result query.
   * The shared param setter resets pagination to page 1.
   *
   * @param {string} sort - API sort field selected by the user.
   * @param {'asc' | 'desc'} direction - Sort direction selected by the user.
   */
  const handleSortChange = useCallback(
    (sort: string, direction: 'asc' | 'desc') => {
      setOptimisticSort({ sort, order: direction });
      setSearchParams({ [URL_PARAMS.SORT]: sort, [URL_PARAMS.ORDER]: direction }, true);
    },
    [setSearchParams]
  );

  /**
   * Applies a new result page to the URL-backed result query.
   * Preserves expression, sort, and page-size state.
   *
   * @param {number} page - One-based result page selected by the user.
   */
  const handlePageChange = useCallback(
    (page: number) => {
      const pageCursor = page > currentPage ? cursor.next : cursor.previous;

      if (pageCursor) {
        setSearchParams({ [URL_PARAMS.PAGE]: String(page), [URL_PARAMS.CURSOR]: pageCursor });
      }
    },
    [currentPage, cursor.next, cursor.previous, setSearchParams]
  );

  /**
   * Applies a new page size to the URL-backed result query.
   * Resets the result page to 1 to avoid requesting an out-of-range page.
   *
   * @param {number} limit - Number of rows to request per page.
   */
  const handlePageSizeChange = useCallback(
    (limit: number) => {
      setSearchParams({ [URL_PARAMS.LIMIT]: String(limit) });
    },
    [setSearchParams]
  );

  return {
    activeSort,
    sortOptions,
    handleSortChange,
    handlePageChange,
    handlePageSizeChange
  };
};

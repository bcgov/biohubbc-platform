import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useCallback, useMemo } from 'react';
import { ApiPaginationResponseParams } from 'types/pagination';
import { type SearchResultSortOption } from '../content/toolbar/SearchResultToolbar';

interface UseSearchResultPagingSortProps {
  /** Pagination metadata returned by the current result request. */
  pagination: ApiPaginationResponseParams | undefined;
  /** URL-aware search parameter setter from `useSearchResults`. */
  setSearchParams: (params: Partial<Record<UrlParamKey, string>>, replace?: boolean) => void;
}

/**
 * Derives sort controls and pagination handlers for search results.
 *
 * Use this hook with `useSearchResults` so result paging and sort interactions
 * update the URL query string through the same normalized parameter setter used
 * by the result loader. The returned sort options are suitable for
 * `SearchResultToolbar`.
 *
 * @param {UseSearchResultPagingSortProps} props - Current pagination metadata and URL-aware search-param setter.
 * @returns Active sort field, toolbar sort options, and handlers for sort, page, and page-size changes.
 */
export const useSearchResultPagingSort = ({ pagination, setSearchParams }: UseSearchResultPagingSortProps) => {
  const activeSort = pagination?.sort ?? 'relevancy_score';
  const sortOrder = pagination?.order ?? 'desc';

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
   *
   * Use this as the toolbar sort-button callback. Updating sort/order through
   * `setSearchParams` also resets pagination to page 1 through the shared search
   * param setter, keeping sort changes and result loading on the same URL path.
   *
   * @param {string} sort - API sort field selected by the user.
   * @param {'asc' | 'desc'} direction - Sort direction selected by the user.
   */
  const handleSortChange = useCallback(
    (sort: string, direction: 'asc' | 'desc') => {
      setSearchParams({ [URL_PARAMS.SORT]: sort, [URL_PARAMS.ORDER]: direction }, true);
    },
    [setSearchParams]
  );

  /**
   * Applies a new result page to the URL-backed result query.
   *
   * Use this as the pagination page-change callback. It updates only the page
   * query param so existing search expression, sort, and page-size state remain
   * intact.
   *
   * @param {number} page - One-based result page selected by the user.
   */
  const handlePageChange = useCallback(
    (page: number) => {
      setSearchParams({ [URL_PARAMS.PAGE]: String(page) });
    },
    [setSearchParams]
  );

  /**
   * Applies a new page size to the URL-backed result query.
   *
   * Use this as the pagination page-size callback. It stores the selected limit
   * and explicitly resets the result page to 1 so the next request cannot ask
   * for an out-of-range page under the new page size.
   *
   * @param {number} limit - Number of rows to request per page.
   */
  const handlePageSizeChange = useCallback(
    (limit: number) => {
      setSearchParams({ [URL_PARAMS.LIMIT]: String(limit), [URL_PARAMS.PAGE]: '1' });
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

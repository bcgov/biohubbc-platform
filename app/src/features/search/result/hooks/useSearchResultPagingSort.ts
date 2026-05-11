import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useCallback, useMemo } from 'react';
import { ApiPaginationResponseParams } from 'types/pagination';

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

  const sortOptions = useMemo(
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

  const handleSortChange = useCallback(
    (sort: string, direction: 'asc' | 'desc') => {
      setSearchParams({ [URL_PARAMS.SORT]: sort, [URL_PARAMS.ORDER]: direction }, true);
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setSearchParams({ [URL_PARAMS.PAGE]: String(page) });
    },
    [setSearchParams]
  );

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

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useEffect } from 'react';
import { CursorPagination } from 'types/pagination';
import { keepPreviousDataWithin } from 'utils/query-client';
import { searchQueryKeys } from 'utils/query-keys/search-query-keys';
import { useSearchPagination } from './useSearchPagination';

/**
 * Loads feature-search results from URL pagination/sort params and an expression tree.
 *
 * Treats URL query params as the source of truth for pagination and sort state, and keys the results on them, the
 * feature type, the submissions searched and the applied expression. The count is keyed on the search alone, not the
 * page or sort. While the next page or expression loads the previous results stay on screen, but only within the same
 * feature type and submissions; the count is shown only for the search on screen.
 *
 * @param {string | undefined} featureTypeName - API feature type route segment to search once route metadata resolves.
 * @param {boolean} enabled - Whether the route has enough context to issue requests.
 * @param {ExpressionTreeExpression | null} expressionTree - Applied expression tree, or null to list target features.
 * @param {number[]} submissionIds - Optional scope.
 * @returns Search rows, pagination, loading state, current URL params, a URL-aware setter, and `reload`, which
 * searches again with everything unchanged.
 */
export const useSearchResults = (
  featureTypeName: string | undefined,
  enabled = true,
  expressionTree: ExpressionTreeExpression | null = null,
  submissionIds?: number[]
) => {
  const api = useApi();
  const queryClient = useQueryClient();
  const { setSnackbar } = useDialogContext();
  const { searchParams, setSearchParams, cursorPagination } = useSearchPagination();
  const canSearch = enabled && Boolean(featureTypeName);
  const scopeKey = searchQueryKeys.featureScope(featureTypeName ?? '', submissionIds);

  const countQuery = useQuery({
    queryKey: searchQueryKeys.featureCount(featureTypeName ?? '', submissionIds, expressionTree),
    queryFn:
      canSearch && featureTypeName
        ? ({ signal }) => api.search.countFeatures(featureTypeName, expressionTree, { signal, submissionIds })
        : skipToken
  });

  const resultsQuery = useQuery({
    queryKey: searchQueryKeys.featureResults(featureTypeName ?? '', submissionIds, expressionTree, cursorPagination),
    queryFn:
      canSearch && featureTypeName
        ? ({ signal }) =>
            api.search.searchFeatures(featureTypeName, expressionTree, cursorPagination, { signal, submissionIds })
        : skipToken,
    placeholderData: keepPreviousDataWithin(scopeKey)
  });

  useEffect(() => {
    if (countQuery.error) {
      setSnackbar({ open: true, snackbarMessage: countQuery.error.message });
    }
  }, [countQuery.error, setSnackbar]);

  useEffect(() => {
    if (resultsQuery.error) {
      setSnackbar({ open: true, snackbarMessage: resultsQuery.error.message });
    }
  }, [resultsQuery.error, setSnackbar]);

  /**
   * Searches again with every input unchanged, reloading the count and the page on screen.
   *
   * @returns {void}
   */
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: scopeKey });
  };

  const currentData = resultsQuery.data;
  const responsePagination = currentData?.pagination;
  const cursor: CursorPagination = {
    limit: cursorPagination.limit,
    sort: responsePagination?.sort ?? cursorPagination.sort,
    order: responsePagination?.order ?? cursorPagination.order,
    next: responsePagination?.next_cursor ?? null,
    previous: responsePagination?.previous_cursor ?? null
  };

  return {
    rows: currentData?.features ?? [],
    properties: currentData?.properties ?? [],
    hasInaccessibleSecuredFeatures: currentData?.has_inaccessible_secured_features ?? false,
    isLoading: !enabled || resultsQuery.isFetching,
    searchParams,
    setSearchParams,
    totalCount: countQuery.data?.total,
    cursor,
    reload
  };
};

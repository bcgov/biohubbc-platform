import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiCursorPaginationRequestOptions, CursorPagination } from 'types/pagination';
import { toApiCursorPagination } from 'utils/pagination';
import { normalizeQueryParam } from 'utils/query-param';
import { isAbortError } from 'utils/request';

/**
 * Custom hook for managing expression search results with URL-driven state, sorting, and pagination.
 *
 * Features:
 * - Reads query params from URL and builds API pagination.
 * - All URL param keys and values are normalized to lowercase for case-insensitive handling.
 * - Provides a single type-safe `setSearchParams` for adding, replacing, appending, or removing params.
 * - Automatically debounces API requests when params change.
 */
interface SearchResultsLoaderInput {
  cursorPagination: ApiCursorPaginationRequestOptions;
  expressionTree: ExpressionTreeExpression | null;
  featureTypeName: string;
  signal: AbortSignal;
}

interface SearchResultData {
  featureTypeName: string;
  response: SearchFeatureResponse;
}

interface SearchResultCount {
  featureTypeName: string;
  expressionTree: ExpressionTreeExpression | null;
  refreshKey: number;
  total: number;
}

/**
 * Loads feature-search results from URL pagination/sort params and an expression tree.
 *
 * Treats URL query params as the source of truth for pagination and sort state.
 * Converts them to the search API pagination payload, calls
 * `/api/search/feature/:featureType`, and returns a typed param setter.
 * Pass `enabled=false` until the route has resolved a valid feature type.
 *
 * @param {string | undefined} featureTypeName - API feature type route segment to search once route metadata resolves.
 * @param {boolean} enabled - Whether the route has enough context to issue requests.
 * @param {ExpressionTreeExpression | null} expressionTree - Applied expression tree, or null to list target features.
 * @param {number} refreshKey - Explicit apply counter; changes abort the active request and start the next one immediately.
 * @returns Search rows, pagination, loading state, current URL params, and URL-aware setter.
 */
export const useSearchResults = (
  featureTypeName: string | undefined,
  enabled = true,
  expressionTree: ExpressionTreeExpression | null = null,
  refreshKey = 0
) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const [data, setData] = useState<SearchResultData>();
  const [count, setCount] = useState<SearchResultCount>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSettled, setHasSettled] = useState(false);
  const searchApiRef = useRef(api.search);
  const dialogContextRef = useRef(dialogContext);
  const setRawSearchParamsRef = useRef(setRawSearchParams);
  const resultsAbortControllerRef = useRef<AbortController | null>(null);
  const resultsRequestIdRef = useRef(0);
  const previousRefreshKeyRef = useRef(refreshKey);
  const previousExpressionTreeRef = useRef(expressionTree);
  const previousSortRef = useRef<Pick<ApiCursorPaginationRequestOptions, 'sort' | 'order'> | null>(null);
  const cursorPagination = useMemo(() => toApiCursorPagination(searchParams), [searchParams]);
  const currentPage = Number(searchParams.get(URL_PARAMS.PAGE) ?? 1);

  useEffect(() => {
    searchApiRef.current = api.search;
    dialogContextRef.current = dialogContext;
    setRawSearchParamsRef.current = setRawSearchParams;
  }, [api.search, dialogContext, setRawSearchParams]);

  const reportRequestError = useCallback((error: unknown) => {
    if (!isAbortError(error)) {
      dialogContextRef.current.setSnackbar({
        open: true,
        snackbarMessage: (error as Error).message
      });
    }
  }, []);

  /**
   * Loads search results for a single prepared request.
   * Converts URL params to API pagination, ignores user-driven aborts, and
   * reports real API errors through the snackbar.
   *
   * @param {SearchResultsLoaderInput} input - URL params, expression, feature type, and abort signal for one request.
   * @returns Search response for the request, or `undefined` when the request was aborted or failed.
   */
  const loadSearchResults = useCallback(
    async ({ cursorPagination, expressionTree, featureTypeName, signal }: SearchResultsLoaderInput) => {
      try {
        return await searchApiRef.current.searchFeatures(featureTypeName, expressionTree, cursorPagination, { signal });
      } catch (error) {
        reportRequestError(error);
        return undefined;
      }
    },
    [reportRequestError]
  );

  /**
   * Starts a latest-wins search request and aborts any active request first.
   * Owns the `AbortController`, loading state, and stale response guard.
   *
   * @param {Omit<SearchResultsLoaderInput, 'signal'>} input - Request inputs before the hook adds an abort signal.
   */
  const startSearch = useCallback(
    async (input: Omit<SearchResultsLoaderInput, 'signal'>) => {
      resultsAbortControllerRef.current?.abort();

      const abortController = new AbortController();
      resultsAbortControllerRef.current = abortController;
      const requestId = resultsRequestIdRef.current + 1;
      resultsRequestIdRef.current = requestId;
      setIsLoading(true);

      const nextData = await loadSearchResults({
        ...input,
        signal: abortController.signal
      });

      if (resultsRequestIdRef.current !== requestId) {
        return;
      }

      setIsLoading(false);

      if (!nextData) {
        return;
      }

      setData({ featureTypeName: input.featureTypeName, response: nextData });
      setHasSettled(true);
    },
    [loadSearchResults]
  );

  const debouncedRefresh = useMemo(() => {
    const debouncedSearch = debounce(startSearch, 300);
    const refresh = (input: Omit<SearchResultsLoaderInput, 'signal'>) => {
      // The request itself is debounced so quick pagination/sort changes coalesce,
      // but the table should enter its loading state immediately. Otherwise stale
      // rows or the "No results found" empty state can flash during the 300ms wait.
      setIsLoading(true);
      debouncedSearch(input);
    };

    refresh.cancel = debouncedSearch.cancel;

    return refresh;
  }, [startSearch]);

  /**
   * Unified setter for URL params.
   *
   * @param updates key-value pairs to set (keys and values will be normalized to lowercase)
   * @param replace If true, replace existing values; if false, append (multi-value)
   */
  const setSearchParams = useCallback(
    (updates: Partial<Record<UrlParamKey, string>>, replace: boolean = true) => {
      const newParams = new TypedURLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        const typedKey = key.toLowerCase() as UrlParamKey;

        if (value === undefined || value === '') {
          newParams.delete(typedKey);
          return;
        }

        const normalizedValue = typedKey === URL_PARAMS.CURSOR ? value : normalizeQueryParam(value);
        if (replace) {
          newParams.set(typedKey, normalizedValue);
        } else {
          newParams.append(typedKey, normalizedValue);
        }
      });

      const navigationParams = new Set<UrlParamKey>([URL_PARAMS.PAGE, URL_PARAMS.CURSOR]);
      const shouldResetPage = Object.keys(updates).some(
        (key) => !navigationParams.has(key.toLowerCase() as UrlParamKey)
      );
      if (shouldResetPage) {
        newParams.set(URL_PARAMS.PAGE, '1');
        newParams.delete(URL_PARAMS.CURSOR);
      }

      setRawSearchParams(newParams);
    },
    [searchParams, setRawSearchParams]
  );

  // Counts depend on the search itself, not the current cursor page or sort.
  useEffect(() => {
    if (!enabled || !featureTypeName) {
      return;
    }

    const abortController = new AbortController();

    void searchApiRef.current
      .countFeatures(featureTypeName, expressionTree, { signal: abortController.signal })
      .then(({ total }) => setCount({ featureTypeName, expressionTree, refreshKey, total }))
      .catch(reportRequestError);

    return () => abortController.abort();
  }, [enabled, expressionTree, featureTypeName, refreshKey, reportRequestError]);

  // Refresh when the route, URL params, applied expression, or explicit refresh key changes.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!featureTypeName) {
      debouncedRefresh.cancel();
      resultsAbortControllerRef.current?.abort();
      setData(undefined);
      setHasSettled(true);
      setIsLoading(false);
      return;
    }

    if (currentPage > 1 && !cursorPagination.cursor) {
      const firstPageParams = new TypedURLSearchParams(searchParams.toString());
      firstPageParams.set(URL_PARAMS.PAGE, '1');
      setRawSearchParamsRef.current(firstPageParams);
      return;
    }

    const input = { cursorPagination, expressionTree, featureTypeName };
    const isExplicitExpressionApply = previousRefreshKeyRef.current !== refreshKey;
    const isExpressionTreeChange = previousExpressionTreeRef.current !== expressionTree;
    const previousSort = previousSortRef.current;
    const isSortChange =
      previousSort !== null &&
      (previousSort.sort !== cursorPagination.sort || previousSort.order !== cursorPagination.order);
    previousRefreshKeyRef.current = refreshKey;
    previousExpressionTreeRef.current = expressionTree;
    previousSortRef.current = { sort: cursorPagination.sort, order: cursorPagination.order };

    // Applying filters or sort changes should feel immediate. A changed expression
    // comes from the URL update; an unchanged re-apply comes from refreshKey.
    // Sort changes also skip the debounce so the previous preview request is
    // cancelled and replaced right away.
    if (isExplicitExpressionApply || isExpressionTreeChange || isSortChange) {
      debouncedRefresh.cancel();
      startSearch(input);
      return;
    }

    // For debounced route/param changes, invalidate the in-flight request before
    // aborting it. The aborted request can still resolve its catch path; without
    // advancing requestId first, that stale completion can set isLoading=false
    // while the new debounced search is still pending, causing an empty-state flash
    // when switching tabs.
    resultsRequestIdRef.current += 1;
    resultsAbortControllerRef.current?.abort();
    debouncedRefresh(input);
  }, [
    searchParams,
    expressionTree,
    featureTypeName,
    enabled,
    refreshKey,
    cursorPagination,
    currentPage,
    debouncedRefresh,
    startSearch
  ]);

  useEffect(
    () => () => {
      debouncedRefresh.cancel();
      resultsAbortControllerRef.current?.abort();
    },
    [debouncedRefresh]
  );

  const currentData = data && data.featureTypeName === featureTypeName ? data.response : undefined;
  const totalCount =
    count &&
    count.featureTypeName === featureTypeName &&
    count.expressionTree === expressionTree &&
    count.refreshKey === refreshKey
      ? count.total
      : undefined;
  const responsePagination = currentData?.pagination;
  const cursor: CursorPagination = {
    limit: responsePagination?.limit ?? cursorPagination.limit,
    sort: responsePagination?.sort ?? cursorPagination.sort,
    order: responsePagination?.order ?? cursorPagination.order,
    next: responsePagination?.next_cursor ?? null,
    previous: responsePagination?.previous_cursor ?? null
  };

  return {
    rows: currentData?.features ?? [],
    properties: currentData?.properties ?? [],
    hasMoreSecuredFeatures: currentData?.has_more_secured_features ?? false,
    isLoading: isLoading || !hasSettled,
    searchParams,
    setSearchParams,
    totalCount,
    currentPage,
    cursor
  };
};

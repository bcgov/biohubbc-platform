import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { normalizeQueryParam } from 'utils/query-param';

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
  params: URLSearchParams;
  expressionTree: ExpressionTreeExpression | null;
  featureTypeName: string;
  signal: AbortSignal;
  submissionIds?: number[];
}

type SearchResultsPagination = ApiPaginationRequestOptions & { sort?: string; order?: 'asc' | 'desc' };

const buildPagination = (params: URLSearchParams): SearchResultsPagination => ({
  page: Number(params.get(URL_PARAMS.PAGE.toLowerCase()) ?? 1),
  limit: Number(params.get(URL_PARAMS.LIMIT.toLowerCase()) ?? 10),
  sort: params.get(URL_PARAMS.SORT.toLowerCase()) ?? undefined,
  order: (params.get(URL_PARAMS.ORDER.toLowerCase()) as 'asc' | 'desc') ?? undefined
});

const buildEmptyResponse = (pagination: SearchResultsPagination): SearchFeatureResponse => ({
  features: [],
  properties: [],
  pagination: {
    total: 0,
    per_page: pagination.limit,
    current_page: pagination.page,
    last_page: 1,
    sort: pagination.sort,
    order: pagination.order
  },
  has_more_secured_features: false
});

const isAbortError = (error: unknown) => {
  return error instanceof Error && (error.name === 'CanceledError' || error.message === 'canceled');
};

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
  refreshKey = 0,
  submissionIds?: number[]
) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const [data, setData] = useState<SearchFeatureResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const [hasSettled, setHasSettled] = useState(false);
  const searchApiRef = useRef(api.search);
  const dialogContextRef = useRef(dialogContext);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const previousRefreshKeyRef = useRef(refreshKey);
  const previousExpressionTreeRef = useRef(expressionTree);
  const previousSortRef = useRef<Pick<SearchResultsPagination, 'sort' | 'order'> | null>(null);

  useEffect(() => {
    searchApiRef.current = api.search;
    dialogContextRef.current = dialogContext;
  }, [api.search, dialogContext]);

  /**
   * Loads search results for a single prepared request.
   * Converts URL params to API pagination, ignores user-driven aborts, and
   * reports real API errors through the snackbar.
   *
   * @param {SearchResultsLoaderInput} input - URL params, expression, feature type, and abort signal for one request.
   * @returns Search response for the request, or `undefined` when the request was aborted or failed.
   */
  const loadSearchResults = useCallback(
    async ({ params, expressionTree, featureTypeName, signal, submissionIds }: SearchResultsLoaderInput) => {
      const pagination = buildPagination(params);

      try {
        return await searchApiRef.current.searchFeatures(featureTypeName, expressionTree, pagination, {
          signal,
          submissionIds
        });
      } catch (error) {
        if (isAbortError(error)) {
          return undefined;
        }

        dialogContextRef.current.setSnackbar({
          open: true,
          snackbarMessage: (error as Error).message
        });
        return undefined;
      }
    },
    []
  );

  /**
   * Starts a latest-wins search request and aborts any active request first.
   * Owns the `AbortController`, loading state, and stale response guard.
   *
   * @param {Omit<SearchResultsLoaderInput, 'signal'>} input - Request inputs before the hook adds an abort signal.
   */
  const startSearch = useCallback(
    async (input: Omit<SearchResultsLoaderInput, 'signal'>) => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);

      const nextData = await loadSearchResults({
        ...input,
        signal: abortController.signal
      });

      if (requestIdRef.current !== requestId) {
        return;
      }

      if (nextData) {
        setData(nextData);
        setHasSettled(true);
      }

      setIsLoading(false);
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
   * Writes normalized result query params to the router.
   * `setSearchParams` owns normalization, deletion, replacement, and pagination
   * reset rules.
   *
   * @param {TypedURLSearchParams} newParams - Complete next query param state for the result route.
   */
  const updateParams = useCallback(
    (newParams: TypedURLSearchParams) => {
      setRawSearchParams(newParams);
    },
    [setRawSearchParams]
  );

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
        const normalizedValue = normalizeQueryParam(value);

        if (normalizedValue === undefined || normalizedValue === '') {
          newParams.delete(typedKey);
        } else if (replace) {
          newParams.delete(typedKey);
          newParams.append(typedKey, normalizedValue);
        } else {
          newParams.append(typedKey, normalizedValue);
        }
      });

      // Reset page unless the only param being changed is PAGE itself
      const shouldResetPage = Object.keys(updates).some(
        (key) => key.toLowerCase() !== (URL_PARAMS.PAGE.toLowerCase() as UrlParamKey)
      );
      if (shouldResetPage) {
        newParams.set(URL_PARAMS.PAGE, '1');
      }

      updateParams(newParams);
    },
    [searchParams, updateParams]
  );

  // Refresh when the route, URL params, applied expression, or explicit refresh key changes.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pagination = buildPagination(searchParams);

    if (!featureTypeName) {
      debouncedRefresh.cancel();
      abortControllerRef.current?.abort();
      setData(buildEmptyResponse(pagination));
      setHasSettled(true);
      setIsLoading(false);
      return;
    }

    const input = { params: searchParams, expressionTree, featureTypeName, submissionIds };
    const isExplicitExpressionApply = previousRefreshKeyRef.current !== refreshKey;
    const isExpressionTreeChange = previousExpressionTreeRef.current !== expressionTree;
    const previousSort = previousSortRef.current;
    const isSortChange =
      previousSort !== null && (previousSort.sort !== pagination.sort || previousSort.order !== pagination.order);
    previousRefreshKeyRef.current = refreshKey;
    previousExpressionTreeRef.current = expressionTree;
    previousSortRef.current = { sort: pagination.sort, order: pagination.order };

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
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    debouncedRefresh(input);
  }, [
    searchParams,
    expressionTree,
    featureTypeName,
    enabled,
    refreshKey,
    submissionIds,
    debouncedRefresh,
    startSearch
  ]);

  useEffect(
    () => () => {
      debouncedRefresh.cancel();
      abortControllerRef.current?.abort();
    },
    [debouncedRefresh]
  );

  return {
    rows: data?.features ?? [],
    properties: data?.properties ?? [],
    hasMoreSecuredFeatures: data?.has_more_secured_features ?? false,
    isLoading: isLoading || !hasSettled,
    searchParams,
    setSearchParams,
    pagination: data?.pagination
  };
};

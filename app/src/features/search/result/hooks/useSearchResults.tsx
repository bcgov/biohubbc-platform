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
  pagination: {
    total: 0,
    per_page: pagination.limit ?? 10,
    current_page: pagination.page ?? 1,
    last_page: 1,
    sort: pagination.sort,
    order: pagination.order
  }
});

const isAbortError = (error: unknown) => {
  return error instanceof Error && (error.name === 'CanceledError' || error.message === 'canceled');
};

/**
 * Loads feature-search results from URL pagination/sort params and an expression tree.
 *
 * Use this hook from result pages that need the current URL query params to be
 * the source of truth for pagination and sort state. It converts those params to
 * the search API pagination payload, calls `/api/search/feature/:featureType`,
 * and returns a typed param setter that keeps the URL and result loader in sync.
 * Pass `enabled=false` until the route has resolved a valid feature type.
 *
 * @param {string} featureTypeName - API feature type route segment to search.
 * @param {boolean} enabled - Whether the route has enough context to issue requests.
 * @param {ExpressionTreeExpression | null} expressionTree - Applied expression tree, or null to list target features.
 * @param {number} refreshKey - Explicit apply counter; changes abort the active request and start the next one immediately.
 * @returns Search rows, pagination, loading state, current URL params, and URL-aware setter.
 */
export const useSearchResults = (
  featureTypeName: string,
  enabled = true,
  expressionTree: ExpressionTreeExpression | null = null,
  refreshKey = 0
) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const [data, setData] = useState<SearchFeatureResponse>();
  const [isLoading, setIsLoading] = useState(false);
  const searchApiRef = useRef(api.search);
  const dialogContextRef = useRef(dialogContext);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const previousRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    searchApiRef.current = api.search;
    dialogContextRef.current = dialogContext;
  }, [api.search, dialogContext]);

  const loadSearchResults = useCallback(
    async ({ params, expressionTree, featureTypeName, signal }: SearchResultsLoaderInput) => {
      const pagination = buildPagination(params);

      try {
        const nextData = featureTypeName
          ? await searchApiRef.current.searchFeatures(featureTypeName, expressionTree, pagination, { signal })
          : buildEmptyResponse(pagination);

        return nextData;
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
      }

      setIsLoading(false);
    },
    [loadSearchResults]
  );

  const debouncedRefresh = useMemo(() => debounce(startSearch, 300), [startSearch]);

  /** Low-level URL param updater */
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

    const input = { params: searchParams, expressionTree, featureTypeName };
    const isExplicitExpressionApply = previousRefreshKeyRef.current !== refreshKey;
    previousRefreshKeyRef.current = refreshKey;

    abortControllerRef.current?.abort();

    if (isExplicitExpressionApply) {
      debouncedRefresh.cancel();
      startSearch(input);
      return;
    }

    debouncedRefresh(input);
  }, [searchParams, expressionTree, featureTypeName, enabled, refreshKey, debouncedRefresh, startSearch]);

  useEffect(
    () => () => {
      debouncedRefresh.cancel();
      abortControllerRef.current?.abort();
    },
    [debouncedRefresh]
  );

  return {
    rows: data?.features ?? [],
    isLoading,
    searchParams,
    setSearchParams,
    pagination: data?.pagination
  };
};

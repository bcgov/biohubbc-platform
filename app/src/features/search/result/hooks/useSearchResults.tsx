import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useRef } from 'react';
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
}

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
 * @returns Search rows, pagination, loading state, current URL params, and URL-aware setter.
 */
export const useSearchResults = (
  featureTypeName: string,
  enabled = true,
  expressionTree: ExpressionTreeExpression | null = null
) => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();

  const buildPagination = (
    params: URLSearchParams
  ): ApiPaginationRequestOptions & { sort?: string; order?: 'asc' | 'desc' } => ({
    page: Number(params.get(URL_PARAMS.PAGE.toLowerCase()) ?? 1),
    limit: Number(params.get(URL_PARAMS.LIMIT.toLowerCase()) ?? 10),
    sort: params.get(URL_PARAMS.SORT.toLowerCase()) ?? undefined,
    order: (params.get(URL_PARAMS.ORDER.toLowerCase()) as 'asc' | 'desc') ?? undefined
  });

  const buildEmptyResponse = (
    pagination: ApiPaginationRequestOptions & { sort?: string; order?: 'asc' | 'desc' }
  ): SearchFeatureResponse => ({
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

  /** Data loader for search results */
  const searchDataLoader = useDataLoader(
    async ({ params, expressionTree, featureTypeName }: SearchResultsLoaderInput): Promise<SearchFeatureResponse> => {
      const pagination = buildPagination(params);

      if (featureTypeName) {
        return api.search.searchFeatures(featureTypeName, expressionTree, pagination);
      }

      return buildEmptyResponse(pagination);
    },
    (error) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as Error).message
      });
    }
  );

  /** Debounced refresh */
  const debouncedRefreshRef = useRef(
    debounce((input: SearchResultsLoaderInput) => searchDataLoader.refresh(input), 300)
  ).current;

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

  const removeSearchParam = useCallback(
    (key: UrlParamKey, value?: string | number) => {
      const normalizedKey = key.toLowerCase() as UrlParamKey;
      const newParams = new TypedURLSearchParams(searchParams.toString());

      if (value !== undefined && value !== null) {
        const normalizedValue = normalizeQueryParam(value);
        const remaining = newParams.getAll(normalizedKey).filter((existingValue) => existingValue !== normalizedValue);

        newParams.delete(normalizedKey);
        remaining.forEach((existingValue) => newParams.append(normalizedKey, existingValue));
      } else {
        newParams.delete(normalizedKey);
      }

      if (normalizedKey !== (URL_PARAMS.PAGE.toLowerCase() as UrlParamKey)) {
        newParams.set(URL_PARAMS.PAGE, '1');
      }

      updateParams(newParams);
    },
    [searchParams, updateParams]
  );

  // Refresh when the route, URL params, or applied expression changes.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    debouncedRefreshRef({ params: searchParams, expressionTree, featureTypeName });
  }, [searchParams, expressionTree, featureTypeName, enabled, debouncedRefreshRef]);

  useEffect(() => () => debouncedRefreshRef.cancel(), [debouncedRefreshRef]);

  return {
    rows: searchDataLoader.data?.features ?? [],
    isLoading: searchDataLoader.isLoading,
    searchParams,
    setSearchParams,
    removeSearchParam,
    pagination: searchDataLoader.data?.pagination
  };
};

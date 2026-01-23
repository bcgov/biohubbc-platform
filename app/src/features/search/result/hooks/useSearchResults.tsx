import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ISearchFeaturesFilters, SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useRef } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';

type NormalizableValue = string | number | undefined;

/**
 * Custom hook for managing search results with URL-driven filters, sorting, and pagination.
 *
 * Features:
 * - Reads query params from URL and builds API request filters + pagination.
 * - All URL param keys and values are normalized to lowercase for case-insensitive handling.
 * - Provides a single type-safe `setSearchParams` for adding, replacing, appending, or removing params.
 * - Automatically debounces API requests when params change.
 */
export const useSearchResults = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();

  /**
   * Normalize value to lowercase
   */
  const normalizeValue = useCallback((value: NormalizableValue): string | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }
    return String(value).toLowerCase();
  }, []);

  /** Build API request from URL params */
  const buildRequest = (params: URLSearchParams) => {
    const filters: ISearchFeaturesFilters = {};

    const pagination: ApiPaginationRequestOptions & { sort?: string; order?: 'asc' | 'desc' } = {
      page: Number(params.get(URL_PARAMS.PAGE.toLowerCase()) ?? 1),
      limit: Number(params.get(URL_PARAMS.LIMIT.toLowerCase()) ?? 10),
      sort: params.get(URL_PARAMS.SORT.toLowerCase()) ?? undefined,
      order: (params.get(URL_PARAMS.ORDER.toLowerCase()) as 'asc' | 'desc') ?? undefined
    };

    params.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      switch (lowerKey) {
        case URL_PARAMS.SPECIES.toLowerCase():
          filters.species = filters.species ?? [];
          filters.species.push(Number(value));
          break;
        case URL_PARAMS.FEATURE_TYPE.toLowerCase():
          filters.feature_types = filters.feature_types ?? [];
          filters.feature_types.push(value);
          break;
        case URL_PARAMS.SEARCH_QUERY.toLowerCase():
          filters.keyword = value;
          break;
        default:
          break;
      }
    });

    return { filters, pagination };
  };

  /** Data loader for search results */
  const searchDataLoader = useDataLoader(
    async (params: URLSearchParams): Promise<SearchFeatureResponse> => {
      const { filters, pagination } = buildRequest(params);
      return api.search.searchFeatures(filters, pagination);
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
    debounce((params: URLSearchParams) => searchDataLoader.refresh(params), 300)
  ).current;

  /** Low-level URL param updater */
  const updateParams = useCallback(
    (newParams: TypedURLSearchParams) => {
      setRawSearchParams(newParams);
      debouncedRefreshRef(newParams);
    },
    [setRawSearchParams, debouncedRefreshRef]
  );

  /**
   * Unified setter for URL params
   * @param updates key-value pairs to set (keys and values will be normalized to lowercase)
   * @param replace If true, replace existing values; if false, append (multi-value)
   * @param callback Optional callback for refreshing recommended options
   */
  const setSearchParams = useCallback(
    (updates: Partial<Record<UrlParamKey, NormalizableValue>>, replace: boolean = true) => {
      const newParams = new TypedURLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        const k = key.toLowerCase() as UrlParamKey;
        const normalizedValue = normalizeValue(value as NormalizableValue);

        if (normalizedValue === undefined || normalizedValue === '') {
          newParams.delete(k);
        } else if (replace) {
          newParams.delete(k);
          newParams.append(k, normalizedValue);
        } else {
          newParams.append(k, normalizedValue);
        }
      });

      // Reset page if any updated param is not PAGE or LIMIT
      const shouldResetPage = Object.keys(updates).some(
        (k) =>
          ![URL_PARAMS.PAGE.toLowerCase() as UrlParamKey, URL_PARAMS.LIMIT.toLowerCase() as UrlParamKey].includes(
            k.toLowerCase() as UrlParamKey
          )
      );
      if (shouldResetPage) {
        newParams.set(URL_PARAMS.PAGE as UrlParamKey, '1');
      }

      updateParams(newParams);
    },
    [searchParams, updateParams, normalizeValue]
  );

  /**
   * Remove a single value from a multi-value param,
   * or all values if value is not provided
   */
  const removeSearchParam = useCallback(
    (key: UrlParamKey, value?: string | number) => {
      const normalizedKey = key.toLowerCase() as UrlParamKey;
      const newParams = new TypedURLSearchParams(searchParams.toString());

      if (value !== undefined) {
        const normalizedValue = normalizeValue(value);
        const remaining = newParams.getAll(normalizedKey).filter((v) => v !== normalizedValue);

        newParams.delete(normalizedKey);
        remaining.forEach((v) => newParams.append(normalizedKey, v));
      } else {
        // No value → remove all values for this key
        newParams.delete(normalizedKey);
      }

      // Reset page unless updating page/limit
      if (
        ![URL_PARAMS.PAGE.toLowerCase() as UrlParamKey, URL_PARAMS.LIMIT.toLowerCase() as UrlParamKey].includes(
          normalizedKey
        )
      ) {
        newParams.set(URL_PARAMS.PAGE as UrlParamKey, '1');
      }

      updateParams(newParams);
    },
    [searchParams, updateParams, normalizeValue]
  );

  const getParam = useCallback((key: UrlParamKey) => searchParams.get(key) ?? undefined, [searchParams]);

  return {
    rows: searchDataLoader.data?.features ?? [],
    isLoading: searchDataLoader.isLoading,
    searchParams,
    setSearchParams,
    getParam,
    removeSearchParam,
    pagination: searchDataLoader.data?.pagination
  };
};

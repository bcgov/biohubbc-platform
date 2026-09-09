import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { useCallback, useMemo } from 'react';
import { toApiCursorPagination } from 'utils/pagination';
import { normalizeQueryParam } from 'utils/query-param';

/**
 * Manages cursor URL state and clears the cursor when search settings change.
 * Legacy page numbers are ignored and removed whenever navigation updates the URL.
 *
 * @returns URL params, their search-aware setter, and API cursor pagination options.
 */
export const useSearchPagination = () => {
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const cursorPagination = useMemo(() => toApiCursorPagination(searchParams), [searchParams]);

  /**
   * Unified setter for URL params.
   *
   * @param {Partial<Record<UrlParamKey, string>>} updates - Params to update; empty values remove params.
   * Keys and non-cursor values are normalized to lowercase, preserving case-sensitive cursor tokens.
   * @returns {void} Updates the URL, clearing the cursor when non-navigation params change.
   */
  const setSearchParams = useCallback(
    (updates: Partial<Record<UrlParamKey, string>>) => {
      const newParams = new TypedURLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        const typedKey = key.toLowerCase() as UrlParamKey;

        if (value === undefined || value === '') {
          newParams.delete(typedKey);
          return;
        }

        const normalizedValue = typedKey === URL_PARAMS.CURSOR ? value : normalizeQueryParam(value);
        newParams.set(typedKey, normalizedValue);
      });

      const shouldClearCursor = Object.keys(updates).some((key) => key.toLowerCase() !== URL_PARAMS.CURSOR);
      if (shouldClearCursor) {
        newParams.delete(URL_PARAMS.CURSOR);
      }

      newParams.delete(URL_PARAMS.PAGE);
      setRawSearchParams(newParams);
    },
    [searchParams, setRawSearchParams]
  );

  return { searchParams, setSearchParams, cursorPagination };
};

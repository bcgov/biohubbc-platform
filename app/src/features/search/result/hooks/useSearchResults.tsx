import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { SearchFeatureResponse } from 'interfaces/useSearchApi.interface';
import { useCallback, useEffect, useState } from 'react';
import { CursorPagination } from 'types/pagination';
import { isAbortError } from 'utils/request';
import { useSearchPagination } from './useSearchPagination';

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
  const { searchFeatures, countFeatures } = useApi().search;
  const { setSnackbar } = useDialogContext();
  const [data, setData] = useState<SearchResultData>();
  const [count, setCount] = useState<SearchResultCount>();
  const [isLoading, setIsLoading] = useState(true);
  const totalCount =
    count &&
    count.featureTypeName === featureTypeName &&
    count.expressionTree === expressionTree &&
    count.refreshKey === refreshKey
      ? count.total
      : undefined;
  const { searchParams, setSearchParams, cursorPagination } = useSearchPagination();

  const reportRequestError = useCallback(
    (error: unknown) => {
      if (!isAbortError(error)) {
        setSnackbar({ open: true, snackbarMessage: (error as Error).message });
      }
    },
    [setSnackbar]
  );

  // Counts depend on the search itself, not the current cursor page or sort.
  useEffect(() => {
    if (!enabled || !featureTypeName) {
      return;
    }
    const controller = new AbortController();
    const loadCount = async () => {
      try {
        const { total } = await countFeatures(featureTypeName, expressionTree, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setCount({ featureTypeName, expressionTree, refreshKey, total });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reportRequestError(error);
        }
      }
    };
    void loadCount();
    return () => controller.abort();
  }, [countFeatures, enabled, expressionTree, featureTypeName, refreshKey, reportRequestError]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!featureTypeName) {
      setData(undefined);
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadResults = async () => {
      try {
        setIsLoading(true);
        const response = await searchFeatures(featureTypeName, expressionTree, cursorPagination, {
          signal: controller.signal
        });
        if (!controller.signal.aborted) {
          setData({ featureTypeName, response });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reportRequestError(error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    void loadResults();
    return () => controller.abort();
  }, [searchFeatures, enabled, featureTypeName, expressionTree, cursorPagination, refreshKey, reportRequestError]);

  const currentData = data && data.featureTypeName === featureTypeName ? data.response : undefined;
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
    isLoading,
    searchParams,
    setSearchParams,
    totalCount,
    cursor
  };
};

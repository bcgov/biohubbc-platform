import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useState } from 'react';
import { normalizeQueryParam } from 'utils/query-param';

/**
 * Manages the expression tree applied to feature search results.
 *
 * Stores the current expression payload and triggers result refreshes when users
 * apply or clear filters. Also resets pagination and clears sort/order when the
 * expression is cleared.
 *
 * @returns Current expression tree, an explicit refresh revision key, and an apply handler for the expression builder.
 */
export const useSearchResultExpression = () => {
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const [expressionTree, setExpressionTree] = useState<ExpressionTreeExpression | null>(null);
  const [expressionApplyRevision, setExpressionApplyRevision] = useState(0);

  /**
   * Applies a new expression tree to the search result page.
   * Increments the revision key so applying the same expression still refreshes
   * results. Clearing the expression also removes sort/order params.
   *
   * @param {ExpressionTreeExpression | null} nextExpressionTree - Expression to apply, or `null` to clear filters.
   */
  const handleExpressionApply = useCallback(
    (nextExpressionTree: ExpressionTreeExpression | null) => {
      setExpressionTree(nextExpressionTree);
      setExpressionApplyRevision((current) => current + 1);

      const nextParams: Partial<Record<UrlParamKey, string>> = {
        [URL_PARAMS.PAGE]: '1'
      };

      if (nextExpressionTree === null) {
        nextParams[URL_PARAMS.SORT] = '';
        nextParams[URL_PARAMS.ORDER] = '';
      }

      const newParams = new TypedURLSearchParams(searchParams.toString());

      Object.entries(nextParams).forEach(([key, value]) => {
        const typedKey = key.toLowerCase() as UrlParamKey;
        const normalizedValue = normalizeQueryParam(value);

        if (normalizedValue === undefined || normalizedValue === '') {
          newParams.delete(typedKey);
        } else {
          newParams.delete(typedKey);
          newParams.append(typedKey, normalizedValue);
        }
      });

      setRawSearchParams(newParams);
    },
    [searchParams, setRawSearchParams]
  );

  return {
    expressionTree,
    expressionApplyRevision,
    handleExpressionApply
  };
};

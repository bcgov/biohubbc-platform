import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useState } from 'react';
import { normalizeQueryParam } from 'utils/query-param';

/**
 * Manages the expression tree applied to feature search results.
 *
 * Use this hook from `SearchResultPage` to store the current expression payload
 * and trigger result refreshes when users apply either a non-empty expression or
 * clear all expression filters. It also resets URL pagination to page 1, and
 * clears sort/order query params when the expression is cleared so the result
 * list returns to the default unfiltered state.
 *
 * @returns Current expression tree, an explicit refresh revision key, and an apply handler for the expression builder.
 */
export const useSearchResultExpression = () => {
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const [expressionTree, setExpressionTree] = useState<ExpressionTreeExpression | null>(null);
  const [expressionApplyRevision, setExpressionApplyRevision] = useState(0);

  /**
   * Applies a new expression tree to the search result page.
   *
   * Use this as the expression builder's Apply action. It stores the expression,
   * increments an explicit revision key so applying the same expression can still
   * refresh results, and resets pagination to the first page. When the expression
   * is cleared, it also removes sort/order params so the unfiltered result set
   * returns to its default ordering.
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

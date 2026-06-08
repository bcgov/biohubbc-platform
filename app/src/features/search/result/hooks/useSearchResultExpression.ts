import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useDialogContext } from 'hooks/useContext';
import { TypedURLSearchParams, useSearchQueryParams } from 'hooks/useSearchQuery';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeQueryParam } from 'utils/query-param';
import { decodeExpressionFromUrl, encodeExpressionToUrl } from 'utils/expression-url';

/**
 * Manages the expression tree applied to feature search results.
 *
 * The applied expression is stored in the URL as a base64url-encoded `expr`
 * query parameter so that pages can be bookmarked, shared, and navigated via
 * browser back/forward while preserving the active search state.
 *
 * - Reading: `expressionTree` is derived from the URL on every render.
 * - Writing: `handleExpressionApply` encodes the expression and updates the URL.
 * - Errors: when `expr` is present but invalid, a non-blocking snackbar is shown
 *   and the expression falls back to `null` without rewriting the URL.
 * - Clearing: when the user clears filters, `expr` is removed and sort/order are reset.
 *
 * @returns Current expression tree, an explicit refresh revision key, and an apply handler.
 */
export const useSearchResultExpression = () => {
  const { searchParams, setSearchParams: setRawSearchParams } = useSearchQueryParams();
  const dialogContext = useDialogContext();
  const [expressionApplyRevision, setExpressionApplyRevision] = useState(0);

  // Track the raw encoded value so we only show the error snackbar once per invalid value.
  const lastInvalidExprRef = useRef<string | null>(null);

  const rawExpr = searchParams.getRaw(URL_PARAMS.EXPR);

  /**
   * Decode the `expr` param into a validated expression tree on every URL change.
   * Returns `null` when the param is absent or decoding/validation fails.
   */
  const expressionTree = useMemo<ExpressionTreeExpression | null>(() => {
    if (!rawExpr) {
      return null;
    }
    return decodeExpressionFromUrl(rawExpr);
  }, [rawExpr]);

  /**
   * When `expr` is present but cannot be decoded/validated, show a non-blocking
   * snackbar error. We guard against re-showing for the same invalid value so
   * this effect only fires once per distinct bad `expr` string.
   */
  useEffect(() => {
    if (rawExpr && expressionTree === null) {
      if (lastInvalidExprRef.current !== rawExpr) {
        lastInvalidExprRef.current = rawExpr;
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Could not load saved search filters'
        });
      }
    } else {
      // Reset the guard when the expr param changes to a valid or absent value.
      lastInvalidExprRef.current = null;
    }
  }, [rawExpr, expressionTree, dialogContext]);

  /**
   * Applies a new expression tree to the search result page.
   *
   * When `nextExpressionTree` is non-null the encoded expression is written to
   * the `expr` URL param and the page resets to page 1. When `null` the `expr`
   * param is removed and sort/order are cleared so results revert to their
   * default ordering.
   *
   * Incrementing `expressionApplyRevision` only when the URL is unchanged ensures
   * re-applying the same expression still refreshes without double-firing normal
   * applies, where the URL change itself triggers the search.
   *
   * @param {ExpressionTreeExpression | null} nextExpressionTree - Expression to apply, or `null` to clear filters.
   */
  const handleExpressionApply = useCallback(
    (nextExpressionTree: ExpressionTreeExpression | null) => {
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

      if (nextExpressionTree === null) {
        newParams.delete(URL_PARAMS.EXPR);
      } else {
        // Use super.set directly on the underlying URLSearchParams to store the
        // base64url value as-is (TypedURLSearchParams.set lowercases values).
        URLSearchParams.prototype.set.call(newParams, URL_PARAMS.EXPR, encodeExpressionToUrl(nextExpressionTree));
      }

      // Most applies change the URL; the search hook observes that URL/expression change
      // and fires one request. Re-applying the exact same filters produces the same URL,
      // so React Router may not rerender. Bump this explicit revision only for that
      // same-URL case so Apply still refreshes without double-requesting normal applies.
      if (newParams.toString() === searchParams.toString()) {
        setExpressionApplyRevision((current) => current + 1);
        return;
      }

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

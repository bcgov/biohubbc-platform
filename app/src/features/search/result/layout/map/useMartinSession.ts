import { TileSessionStatus, UseTileSessionResult, useTileSession } from 'components/map/useTileSession';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IMartinSession } from 'interfaces/useMartinApi.interface';
import { useCallback, useMemo } from 'react';

export type MartinSessionStatus = TileSessionStatus;

export type UseMartinSessionResult = UseTileSessionResult<IMartinSession>;

/**
 * Owns the Martin session for the map view: creation, refresh before expiry, and recovery from a rejected tile request.
 *
 * A binding of {@link useTileSession} to the search endpoint. The session is re-created whenever the search changes,
 * so the map always reflects the same result set as the table. A mint that fails outside a background recovery also
 * raises a snackbar: a failed recovery already routes to the error state and its "Try again", and stacking a
 * snackbar per attempt on top of that would only pile up noise.
 *
 * @param {string} featureTypeName - Feature type being searched.
 * @param {(ExpressionTreeExpression | null)} expressionTree - Search expression, or null for an unfiltered view.
 * @param {boolean} enabled - Whether the map view is active. While false nothing is requested, refreshed or retried,
 * but the session already in hand is kept: the map stays mounted behind the table view and has to come back with its
 * viewport and tiles intact.
 * @param {number[]} submissionIds - Optional scope. Memoize derived arrays at the caller to preserve the session.
 * @return {UseMartinSessionResult}
 */
export const useMartinSession = (
  featureTypeName: string,
  expressionTree: ExpressionTreeExpression | null,
  enabled: boolean,
  submissionIds?: number[]
): UseMartinSessionResult => {
  const api = useApi();
  const dialogContext = useDialogContext();

  // The search is identified by reference, exactly as the effect dependencies were: a new expression object or scope
  // array is a new search even when its content is the same.
  const sessionKey = useMemo(
    () => ({ featureTypeName, expressionTree, submissionIds }),
    [featureTypeName, expressionTree, submissionIds]
  );

  const mint = useCallback(
    (signal: AbortSignal) => api.martin.createMartinSession(featureTypeName, expressionTree, { signal, submissionIds }),
    [api, featureTypeName, expressionTree, submissionIds]
  );

  const onMintError = useCallback(
    (error: unknown, context: { isRecovery: boolean }) => {
      if (context.isRecovery) {
        return;
      }

      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as Error).message
      });
    },
    [dialogContext]
  );

  return useTileSession<IMartinSession>({ sessionKey, enabled, mint, onMintError });
};

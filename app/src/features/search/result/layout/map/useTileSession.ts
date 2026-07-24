import { useDialogContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ITileSession } from 'interfaces/useTileApi.interface';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Refresh this many seconds before the token expires, so a tile request never races the expiry. */
const REFRESH_LEAD_SECONDS = 60;

export type TileSessionStatus = 'loading' | 'ready' | 'over_cap' | 'error';

export interface UseTileSessionResult {
  status: TileSessionStatus;
  /** The active session. Present whenever status is 'ready'. */
  session: ITileSession | null;
  /** Maximum mappable features, when the search was refused for being too large. */
  cap: number | null;
  /**
   * Current tile token, read at request time.
   *
   * A ref rather than state on purpose: the token rotates on refresh, and re-rendering the map for that would tear
   * down and rebuild it mid-session.
   */
  tokenRef: React.MutableRefObject<string | null>;
  /** Re-request a session, e.g. after a tile request was rejected. */
  refresh: () => void;
}

const isAbortError = (error: unknown) => {
  return error instanceof Error && (error.name === 'CanceledError' || error.message === 'canceled');
};

/**
 * Owns the tile session for the map view: creation, refresh before expiry, and recovery from a rejected tile request.
 *
 * The session is re-created whenever the search changes, so the map always reflects the same result set as the table.
 * The token is short lived and kept in memory only.
 *
 * @param {string} featureTypeName - Feature type being searched.
 * @param {(ExpressionTreeExpression | null)} expressionTree - Search expression, or null for an unfiltered view.
 * @param {boolean} enabled - Whether the map view is active. No session is requested while false.
 * @return {UseTileSessionResult}
 */
export const useTileSession = (
  featureTypeName: string,
  expressionTree: ExpressionTreeExpression | null,
  enabled: boolean
): UseTileSessionResult => {
  const api = useApi();
  const dialogContext = useDialogContext();

  const [status, setStatus] = useState<TileSessionStatus>('loading');
  const [session, setSession] = useState<ITileSession | null>(null);
  const [cap, setCap] = useState<number | null>(null);

  const tokenRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a burst of tile errors triggering a burst of refreshes.
  const isRefreshingRef = useRef(false);
  // Two consecutive failures mean refreshing is not helping, so stop and surface the problem.
  const consecutiveFailuresRef = useRef(0);
  const [refreshCount, setRefreshCount] = useState(0);

  const apiRef = useRef(api);
  const dialogContextRef = useRef(dialogContext);

  useEffect(() => {
    apiRef.current = api;
    dialogContextRef.current = dialogContext;
  });

  const refresh = useCallback(() => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setRefreshCount((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Cancel any request still in flight for a previous search, so a slow response cannot overwrite a newer one.
    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let isCurrent = true;

    const createSession = async () => {
      try {
        const response = await apiRef.current.tile.createTileSession(featureTypeName, expressionTree, {
          signal: abortController.signal
        });

        if (!isCurrent) {
          return;
        }

        if (response.over_cap) {
          tokenRef.current = null;
          setSession(null);
          setCap(response.cap);
          setStatus('over_cap');
          consecutiveFailuresRef.current = 0;
          return;
        }

        tokenRef.current = response.token;
        setSession(response);
        setCap(null);
        setStatus('ready');
        consecutiveFailuresRef.current = 0;
      } catch (error) {
        if (isAbortError(error) || !isCurrent) {
          return;
        }

        consecutiveFailuresRef.current += 1;
        tokenRef.current = null;
        setStatus('error');

        dialogContextRef.current.setSnackbar({
          open: true,
          snackbarMessage: (error as Error).message
        });
      } finally {
        isRefreshingRef.current = false;
      }
    };

    createSession();

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [featureTypeName, expressionTree, enabled, refreshCount]);

  // Refresh shortly before the token expires. The API reuses the underlying authorization context where it can, so a
  // refresh usually rotates only the token and leaves the rendered tiles untouched.
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!enabled || !session) {
      return;
    }

    const delaySeconds = Math.max(session.token_expires_in - REFRESH_LEAD_SECONDS, 1);

    refreshTimerRef.current = setTimeout(() => {
      isRefreshingRef.current = false;
      refresh();
    }, delaySeconds * 1000);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [session, enabled, refresh]);

  // Leaving the map view drops the token and cancels anything in flight.
  useEffect(() => {
    if (enabled) {
      return;
    }

    abortControllerRef.current?.abort();
    tokenRef.current = null;
    setSession(null);
    setStatus('loading');
  }, [enabled]);

  /**
   * Recover from a rejected tile request by re-requesting the session once.
   *
   * `transformRequest` cannot see responses, so an expired token surfaces as a source error rather than a 401 the
   * caller can inspect. A second consecutive failure means a new token will not help.
   */
  const handleTileFailure = useCallback(() => {
    if (consecutiveFailuresRef.current >= 1) {
      setStatus('error');
      return;
    }

    consecutiveFailuresRef.current += 1;
    refresh();
  }, [refresh]);

  return { status, session, cap, tokenRef, refresh: handleTileFailure };
};

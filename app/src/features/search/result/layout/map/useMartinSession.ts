import { useDialogContext } from 'hooks/useContext';
import { useApi } from 'hooks/useApi';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IMartinSession } from 'interfaces/useMartinApi.interface';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Refresh this many seconds before the token expires, so a tile request never races the expiry. */
const REFRESH_LEAD_SECONDS = 60;

/**
 * How many times a tile error may trigger an automatic re-mint before the map gives up and surfaces an
 * error. Bounds a persistent, non-token failure (eg: the gateway is down) to a few attempts rather than
 * an unbounded storm of re-mints.
 */
const MAX_AUTO_RECOVERIES = 2;

export type MartinSessionStatus = 'loading' | 'ready' | 'over_cap' | 'error';

export interface UseMartinSessionResult {
  status: MartinSessionStatus;
  /** The active session. Present whenever status is 'ready'. */
  session: IMartinSession | null;
  /** Maximum mappable features, when the search was refused for being too large. */
  cap: number | null;
  /**
   * Current tile token, read at request time.
   *
   * A ref rather than state on purpose: the token rotates on refresh, and re-rendering the map for that would tear
   * down and rebuild it mid-session.
   */
  tokenRef: React.MutableRefObject<string | null>;
  /**
   * Bumped whenever the rendered tiles must be re-requested from scratch (manual retry or automatic
   * recovery). Fold it into the map's React key so recovery forces a clean remount; a token-only refresh
   * before expiry leaves it untouched and never remounts.
   */
  reloadNonce: number;
  /** Manually re-request the session from a clean slate, eg: the user clicking "Try again". */
  retry: () => void;
  /** Report that a tile request failed, triggering one bounded automatic recovery attempt. */
  onTileError: () => void;
}

const isAbortError = (error: unknown) => {
  return error instanceof Error && (error.name === 'CanceledError' || error.message === 'canceled');
};

/**
 * Owns the Martin session for the map view: creation, refresh before expiry, and recovery from a rejected tile request.
 *
 * The session is re-created whenever the search changes, so the map always reflects the same result set as the table.
 * The token is short lived and kept in memory only.
 *
 * Recovery is split by intent. A tile error (`onTileError`) triggers at most `MAX_AUTO_RECOVERIES` background
 * re-mints before giving up, so a persistent failure cannot storm the mint endpoint. A manual `retry` always starts
 * from a clean slate, so the "Try again" button works even from the error state, where automatic recovery has already
 * given up. Both bump `reloadNonce` to force the tiles to be re-requested; the pre-expiry token refresh does not, so it
 * rotates the token without disturbing the rendered map.
 *
 * @param {string} featureTypeName - Feature type being searched.
 * @param {(ExpressionTreeExpression | null)} expressionTree - Search expression, or null for an unfiltered view.
 * @param {boolean} enabled - Whether the map view is active. No session is requested while false.
 * @return {UseMartinSessionResult}
 */
export const useMartinSession = (
  featureTypeName: string,
  expressionTree: ExpressionTreeExpression | null,
  enabled: boolean
): UseMartinSessionResult => {
  const api = useApi();
  const dialogContext = useDialogContext();

  const [status, setStatus] = useState<MartinSessionStatus>('loading');
  const [session, setSession] = useState<IMartinSession | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const tokenRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while a mint is in flight, so a burst of tile errors triggers a single recovery, not a storm.
  const mintInFlightRef = useRef(false);
  // Consecutive automatic recoveries not yet cleared by a fresh attempt (new search, manual retry, or pre-expiry
  // refresh). It deliberately survives a successful re-mint: a persistent non-token failure keeps erroring after each
  // successful mint, and this counter is what eventually stops it.
  const autoRecoveryCountRef = useRef(0);
  // Set by onTileError so the mint effect knows the next mint is a recovery and must not clear the counter.
  const pendingRecoveryRef = useRef(false);
  const [mintCount, setMintCount] = useState(0);

  const apiRef = useRef(api);
  const dialogContextRef = useRef(dialogContext);

  useEffect(() => {
    apiRef.current = api;
    dialogContextRef.current = dialogContext;
  });

  /** Run the mint effect again. */
  const triggerMint = useCallback(() => {
    setMintCount((count) => count + 1);
  }, []);

  /**
   * Report that a tile request failed. `transformRequest` cannot see responses, so an expired token surfaces as a
   * source error rather than a 401 the caller can inspect. Re-mint to recover a likely-expired token, but only up to
   * `MAX_AUTO_RECOVERIES` times so a persistent failure gives up instead of re-minting forever.
   *
   * Deliberately does NOT bump the reload nonce here: the nonce remounts the map, and remounting before the re-mint
   * resolves would issue a fresh round of tile requests with the same rejected token still in the ref. Those failures
   * would be swallowed by the in-flight guard and nothing would re-request the tiles when the new token finally
   * arrived, leaving a permanently blank map. The nonce is bumped by the mint effect once the new token is in place.
   */
  const onTileError = useCallback(() => {
    if (mintInFlightRef.current) {
      // A mint is already addressing this; further errors from the same burst are the same problem.
      return;
    }

    if (autoRecoveryCountRef.current >= MAX_AUTO_RECOVERIES) {
      // Give up visibly. Dropping the session is what routes rendering to the error state and its
      // "Try again": with a stale session left in place, retry would re-render the map immediately
      // with a dead token instead of showing the loading skeleton.
      tokenRef.current = null;
      setSession(null);
      setStatus('error');
      return;
    }

    autoRecoveryCountRef.current += 1;
    pendingRecoveryRef.current = true;
    mintInFlightRef.current = true;
    triggerMint();
  }, [triggerMint]);

  /**
   * Re-request the session from a clean slate. Resets the recovery budget and forces the tiles to be re-requested, so
   * it recovers even from the error state, where automatic recovery has given up.
   */
  const retry = useCallback(() => {
    autoRecoveryCountRef.current = 0;
    mintInFlightRef.current = true;
    setStatus('loading');
    setReloadNonce((nonce) => nonce + 1);
    triggerMint();
  }, [triggerMint]);

  // Drop the previous search's session as soon as the search changes, rather than when its replacement arrives.
  // Materializing a filtered context can take seconds, and without this the map keeps rendering the previous
  // search's geometry and cluster counts the whole time - clickable, and wrong. Declared before the mint effect so
  // it runs first on a search change; it does not run for a refresh or a recovery, which reuse the same search and
  // must leave the rendered map alone.
  useEffect(() => {
    tokenRef.current = null;
    setSession(null);
    setStatus('loading');
  }, [featureTypeName, expressionTree]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Cancel any request still in flight for a previous search, so a slow response cannot overwrite a newer one.
    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // A mint not flagged as a recovery is a fresh attempt (new search, manual retry, or pre-expiry refresh), which
    // clears the recovery budget.
    const isRecovery = pendingRecoveryRef.current;
    pendingRecoveryRef.current = false;

    if (!isRecovery) {
      autoRecoveryCountRef.current = 0;
    }

    mintInFlightRef.current = true;

    let isCurrent = true;

    const createSession = async () => {
      try {
        const response = await apiRef.current.martin.createMartinSession(featureTypeName, expressionTree, {
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
          return;
        }

        tokenRef.current = response.token;
        setSession(response);
        setCap(null);
        setStatus('ready');

        if (isRecovery) {
          // Only NOW is it safe to re-request the rendered tiles: the new token is in the ref, so
          // the remounted map's first requests carry it. MapLibre never retries a tile it has
          // marked errored, and a recovery usually reuses the same context id, so without this
          // bump nothing would ever re-request the failed tiles.
          setReloadNonce((nonce) => nonce + 1);
        }
      } catch (error) {
        if (isAbortError(error) || !isCurrent) {
          return;
        }

        tokenRef.current = null;
        setSession(null);
        setStatus('error');

        dialogContextRef.current.setSnackbar({
          open: true,
          snackbarMessage: (error as Error).message
        });
      } finally {
        // Only the current mint owns the flag; a superseded one leaves it for its replacement to manage.
        if (isCurrent) {
          mintInFlightRef.current = false;
        }
      }
    };

    createSession();

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [featureTypeName, expressionTree, enabled, mintCount]);

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
      // A pre-expiry refresh is not a recovery: rotate the token without bumping the reload nonce, so the rendered
      // tiles are left in place.
      triggerMint();
    }, delaySeconds * 1000);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [session, enabled, triggerMint]);

  // Leaving the map view drops the token and cancels anything in flight.
  useEffect(() => {
    if (enabled) {
      return;
    }

    abortControllerRef.current?.abort();
    mintInFlightRef.current = false;
    tokenRef.current = null;
    setSession(null);
    setStatus('loading');
  }, [enabled]);

  return { status, session, cap, tokenRef, reloadNonce, retry, onTileError };
};

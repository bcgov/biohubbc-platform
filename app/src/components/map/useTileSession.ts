import {
  MARTIN_AUTO_RECOVERY_BACKOFF_BASE_MS,
  MARTIN_MAX_AUTO_RECOVERIES,
  MARTIN_REFRESH_LEAD_SECONDS
} from 'constants/martin';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from 'utils/request';

export type TileSessionStatus = 'loading' | 'ready' | 'empty' | 'error';

/**
 * The credential part of a minted tile session: the token to attach to tile requests, and when to rotate it. This is
 * all the lifecycle needs; each session type adds whatever its map uses to draw.
 */
export interface TileSessionCredentials {
  token: string;
  /** Token lifetime in seconds. The session is refreshed before this elapses. */
  token_expires_in: number;
}

export interface UseTileSessionOptions<TSession extends TileSessionCredentials> {
  /**
   * Identity of the mapped subject, compared with `Object.is`. A change drops the session in hand and mints a new one;
   * a refresh or a recovery reuses the same key and leaves the rendered map alone.
   */
  sessionKey: unknown;
  /**
   * Whether the map is active. While false nothing is requested, refreshed or retried, but a session already in hand
   * is kept, so a map that stays mounted behind another view comes back with its viewport and tiles intact. Defaults
   * to true.
   */
  enabled?: boolean;
  /**
   * Mint a session for the subject. Resolve `null` when the subject has nothing to map, which routes to the `empty`
   * status without a token. Read through a ref at call time, so callers need not memoise it.
   */
  mint: (signal: AbortSignal) => Promise<TSession | null>;
  /**
   * Called when a mint fails for a reason other than being superseded. `isRecovery` is true for a background re-mint
   * triggered by a tile error, which already routes to the error state on its own. Read through a ref at call time.
   */
  onMintError?: (error: unknown, context: { isRecovery: boolean }) => void;
}

export interface UseTileSessionResult<TSession extends TileSessionCredentials> {
  status: TileSessionStatus;
  /** The active session. Present whenever status is 'ready'. */
  session: TSession | null;
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

/**
 * Owns the lifecycle of one Martin tile session: creation, refresh before expiry, and recovery from a rejected tile
 * request. What is being mapped is the caller's business; this hook only knows how to keep a token valid for it.
 *
 * The session is re-created whenever `sessionKey` changes, so navigating between subjects replaces the token and the
 * tiles rather than layering the new subject's geometry over the old. The token is short lived and kept in memory
 * only.
 *
 * Recovery is split by intent. A tile error (`onTileError`) triggers at most `MARTIN_MAX_AUTO_RECOVERIES` background
 * re-mints, each after an exponentially growing delay, before giving up, so a persistent failure cannot storm the
 * mint endpoint or the tile service. A manual `retry` always starts immediately from a clean slate, so the
 * "Try again" button works even from the error state, where automatic recovery has already given up. Both bump
 * `reloadNonce` to force the tiles to be re-requested; the pre-expiry token refresh does not, so it rotates the token
 * without disturbing the rendered map.
 *
 * A failure is always reported through `status`; whether anything else happens (a snackbar, say) is up to the
 * caller's `onMintError`.
 *
 * @template TSession
 * @param {UseTileSessionOptions<TSession>} options
 * @return {UseTileSessionResult<TSession>}
 */
export const useTileSession = <TSession extends TileSessionCredentials>(
  options: UseTileSessionOptions<TSession>
): UseTileSessionResult<TSession> => {
  const { sessionKey, enabled = true, mint, onMintError } = options;

  const [status, setStatus] = useState<TileSessionStatus>('loading');
  const [session, setSession] = useState<TSession | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const tokenRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pending backoff delay before an automatic recovery re-mint fires.
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while a mint is in flight or scheduled, so a burst of tile errors triggers a single recovery, not a storm.
  const mintInFlightRef = useRef(false);
  // Consecutive automatic recoveries not yet cleared by a fresh attempt (new subject, manual retry, or pre-expiry
  // refresh). It deliberately survives a successful re-mint: a persistent non-token failure keeps erroring after each
  // successful mint, and this counter is what eventually stops it.
  const autoRecoveryCountRef = useRef(0);
  // Set by onTileError so the mint effect knows the next mint is a recovery and must not clear the counter.
  const pendingRecoveryRef = useRef(false);
  const [mintCount, setMintCount] = useState(0);

  // Declared before the mint effect so that, on a key change, the mint effect below always sees the callbacks that
  // belong to the new key rather than the previous render's closures.
  const mintRef = useRef(mint);
  const onMintErrorRef = useRef(onMintError);

  useEffect(() => {
    mintRef.current = mint;
    onMintErrorRef.current = onMintError;
  });

  /** Run the mint effect again. */
  const triggerMint = useCallback(() => {
    setMintCount((count) => count + 1);
  }, []);

  /** Cancel a scheduled automatic recovery, if one is waiting out its backoff. */
  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  /**
   * Report that a tile request failed. `transformRequest` cannot see responses, so an expired token surfaces as a
   * source error rather than a 401 the caller can inspect. Re-mint to recover a likely-expired token, but only up to
   * `MARTIN_MAX_AUTO_RECOVERIES` times, each attempt delayed with exponential backoff so a service that is down sees
   * spaced-out attempts rather than an immediate burst.
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

    if (autoRecoveryCountRef.current >= MARTIN_MAX_AUTO_RECOVERIES) {
      // Give up visibly. Dropping the session is what routes rendering to the error state and its
      // "Try again": with a stale session left in place, retry would re-render the map immediately
      // with a dead token instead of showing the loading skeleton.
      tokenRef.current = null;
      setSession(null);
      setStatus('error');
      return;
    }

    const backoffMs = MARTIN_AUTO_RECOVERY_BACKOFF_BASE_MS * 2 ** autoRecoveryCountRef.current;

    autoRecoveryCountRef.current += 1;
    pendingRecoveryRef.current = true;
    // Claimed now, not when the timer fires, so tile errors arriving during the backoff are absorbed.
    mintInFlightRef.current = true;

    recoveryTimerRef.current = setTimeout(() => {
      recoveryTimerRef.current = null;
      triggerMint();
    }, backoffMs);
  }, [triggerMint]);

  /**
   * Re-request the session from a clean slate, immediately. Resets the recovery budget and forces the tiles to be
   * re-requested, so it recovers even from the error state, where automatic recovery has given up.
   */
  const retry = useCallback(() => {
    clearRecoveryTimer();
    pendingRecoveryRef.current = false;
    autoRecoveryCountRef.current = 0;
    mintInFlightRef.current = true;
    setStatus('loading');
    setReloadNonce((nonce) => nonce + 1);
    triggerMint();
  }, [clearRecoveryTimer, triggerMint]);

  // Drop the previous subject's session as soon as the key changes, rather than when its replacement arrives.
  // Without this the old subject's tiles stay on screen for the length of the mint request, which reads as the new
  // subject having the old one's geometry. Declared before the mint effect so it runs first on a key change; it does
  // not run for a refresh or a recovery, which reuse the same key and must leave the rendered map alone.
  useEffect(() => {
    clearRecoveryTimer();
    pendingRecoveryRef.current = false;
    tokenRef.current = null;
    setSession(null);
    setStatus('loading');
  }, [sessionKey, clearRecoveryTimer]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Cancel any request still in flight for a previous subject, so a slow response cannot overwrite a newer one.
    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // A mint not flagged as a recovery is a fresh attempt (new subject, manual retry, or pre-expiry refresh), which
    // clears the recovery budget.
    const isRecovery = pendingRecoveryRef.current;
    pendingRecoveryRef.current = false;

    if (!isRecovery) {
      autoRecoveryCountRef.current = 0;
    }

    mintInFlightRef.current = true;

    let isCurrent = true;

    const mintSession = async () => {
      try {
        const response = await mintRef.current(abortController.signal);

        if (!isCurrent) {
          return;
        }

        if (!response) {
          tokenRef.current = null;
          setSession(null);
          setStatus('empty');
          return;
        }

        tokenRef.current = response.token;
        setSession(response);
        setStatus('ready');

        if (isRecovery) {
          // Only NOW is it safe to re-request the rendered tiles: the new token is in the ref, so
          // the remounted map's first requests carry it. MapLibre never retries a tile it has
          // marked errored, so without this bump nothing would ever re-request the failed tiles.
          setReloadNonce((nonce) => nonce + 1);
        }
      } catch (error) {
        if (isAbortError(error) || !isCurrent) {
          return;
        }

        tokenRef.current = null;
        setSession(null);
        setStatus('error');

        onMintErrorRef.current?.(error, { isRecovery });
      } finally {
        // Only the current mint owns the flag; a superseded one leaves it for its replacement to manage.
        if (isCurrent) {
          mintInFlightRef.current = false;
        }
      }
    };

    mintSession();

    return () => {
      isCurrent = false;
      abortController.abort();
    };
  }, [sessionKey, enabled, mintCount]);

  // Refresh shortly before the token expires, so a map left open on a page keeps working.
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!enabled || !session) {
      return;
    }

    const delaySeconds = Math.max(session.token_expires_in - MARTIN_REFRESH_LEAD_SECONDS, 1);

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

  // Disabling stops the work but keeps what is already on screen: only scheduled and in-flight work is cancelled, and
  // re-enabling re-mints, which rotates a token that may have expired meanwhile.
  useEffect(() => {
    if (enabled) {
      return;
    }

    abortControllerRef.current?.abort();
    clearRecoveryTimer();
    pendingRecoveryRef.current = false;
    mintInFlightRef.current = false;
  }, [enabled, clearRecoveryTimer]);

  // Unmounting must leave no timer behind to fire into an unmounted component.
  useEffect(() => {
    return () => {
      clearRecoveryTimer();
    };
  }, [clearRecoveryTimer]);

  return { status, session, tokenRef, reloadNonce, retry, onTileError };
};

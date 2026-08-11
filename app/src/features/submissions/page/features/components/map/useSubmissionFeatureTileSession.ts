import { useApi } from 'hooks/useApi';
import { ISubmissionFeatureTileSession } from 'interfaces/useMartinApi.interface';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Refresh this many seconds before the token expires, so a tile request never races the expiry. */
const REFRESH_LEAD_SECONDS = 60;

/**
 * How many times a tile error may trigger an automatic re-mint before the map gives up and surfaces an
 * error. Bounds a persistent, non-token failure (eg: the gateway is down) to a few attempts rather than
 * an unbounded storm of re-mints.
 */
const MAX_AUTO_RECOVERIES = 2;

export type SubmissionFeatureTileSessionStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface UseSubmissionFeatureTileSessionResult {
  status: SubmissionFeatureTileSessionStatus;
  /** The active session. Present whenever status is 'ready'. */
  session: ISubmissionFeatureTileSession | null;
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
 * Owns the tile session for one submission feature's map: creation, refresh before expiry, and recovery from a
 * rejected tile request.
 *
 * The session is re-created whenever the feature changes, so navigating between features replaces the token and the
 * tiles rather than layering a second feature's geometry over the first. The token is short lived and kept in memory
 * only.
 *
 * Recovery is split by intent. A tile error (`onTileError`) triggers at most `MAX_AUTO_RECOVERIES` background
 * re-mints before giving up, so a persistent failure cannot storm the mint endpoint. A manual `retry` always starts
 * from a clean slate, so the "Try again" button works even from the error state, where automatic recovery has already
 * given up. Both bump `reloadNonce` to force the tiles to be re-requested; the pre-expiry token refresh does not, so it
 * rotates the token without disturbing the rendered map.
 *
 * A failure is reported through `status` alone rather than a snackbar: the map is one section of a page whose other
 * sections stay usable, so it must not raise an app-level notification.
 *
 * @param {number} submissionId
 * @param {number} submissionFeatureId
 * @return {UseSubmissionFeatureTileSessionResult}
 */
export const useSubmissionFeatureTileSession = (
  submissionId: number,
  submissionFeatureId: number
): UseSubmissionFeatureTileSessionResult => {
  const api = useApi();

  const [status, setStatus] = useState<SubmissionFeatureTileSessionStatus>('loading');
  const [session, setSession] = useState<ISubmissionFeatureTileSession | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const tokenRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while a mint is in flight, so a burst of tile errors triggers a single recovery, not a storm.
  const mintInFlightRef = useRef(false);
  // Consecutive automatic recoveries not yet cleared by a fresh attempt (new feature, manual retry, or pre-expiry
  // refresh). It deliberately survives a successful re-mint: a persistent non-token failure keeps erroring after each
  // successful mint, and this counter is what eventually stops it.
  const autoRecoveryCountRef = useRef(0);
  // Set by onTileError so the mint effect knows the next mint is a recovery and must not clear the counter.
  const pendingRecoveryRef = useRef(false);
  const [mintCount, setMintCount] = useState(0);

  const apiRef = useRef(api);

  useEffect(() => {
    apiRef.current = api;
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
      // "Try again"; a stale session would keep a dead-token map on screen instead.
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

  // Drop the previous feature's session as soon as the route changes, rather than when its replacement arrives.
  // Without this the old feature's tiles stay on screen for the length of the mint request, which reads as the new
  // feature having the old one's geometry. Declared before the mint effect so it runs first on an id change; it does
  // not run for a refresh or a recovery, which reuse the same ids and must leave the rendered map alone.
  useEffect(() => {
    tokenRef.current = null;
    setSession(null);
    setStatus('loading');
  }, [submissionId, submissionFeatureId]);

  useEffect(() => {
    // Cancel any request still in flight for a previous feature, so a slow response cannot overwrite a newer one.
    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // A mint not flagged as a recovery is a fresh attempt (new feature, manual retry, or pre-expiry refresh), which
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
        const response = await apiRef.current.martin.createSubmissionFeatureTileSession(
          submissionId,
          submissionFeatureId,
          { signal: abortController.signal }
        );

        if (!isCurrent) {
          return;
        }

        if (!response.has_spatial_properties) {
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
  }, [submissionId, submissionFeatureId, mintCount]);

  // Refresh shortly before the token expires, so a map left open on a page keeps working.
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!session) {
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
  }, [session, triggerMint]);

  return { status, session, tokenRef, reloadNonce, retry, onTileError };
};

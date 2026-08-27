/**
 * Coalesces concurrent upstream fetches for the same tile.
 *
 * An entry lives only as long as its fetch: nothing is retained once one settles, so this collapses
 * the thundering herd a cold viewport pan produces — many simultaneous requests for the same tile —
 * into a single upstream round trip without holding tiles anywhere. Caching them is Martin's, keyed
 * by the query string the gateway builds.
 */

export interface UpstreamTile {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/** Fetches currently in flight, keyed by the exact upstream path being requested. */
const inflight = new Map<string, Promise<UpstreamTile>>();

/**
 * Run `loader` for `key`, unless an identical fetch is already in flight, in which case its result
 * is shared.
 *
 * The entry is removed as soon as the loader settles, success or failure, so errors are never
 * sticky and nothing outlives the request that produced it.
 *
 * @param {string} key
 * @param {() => Promise<UpstreamTile>} loader
 * @return {*}  {Promise<UpstreamTile>}
 */
export const loadTileCoalesced = async (key: string, loader: () => Promise<UpstreamTile>): Promise<UpstreamTile> => {
  const pending = inflight.get(key);

  if (pending) {
    return pending;
  }

  const promise = loader().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);

  return promise;
};

/**
 * Drop every in-flight entry. Test seam.
 *
 * @return {void}
 */
export const clearInflight = () => {
  inflight.clear();
};

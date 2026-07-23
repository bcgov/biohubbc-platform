import { LRUCache } from 'lru-cache';
import { config } from '../config.js';

export interface CachedTile {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/**
 * In memory tile cache.
 *
 * Sized by total body bytes rather than entry count, because tile sizes vary by orders of magnitude
 * between an empty ocean tile and a dense urban one.
 */
const cache = new LRUCache<string, CachedTile>({
  maxSize: config.cacheMaxBytes,
  sizeCalculation: (value) => Math.max(value.body.length, 1),
  ttl: config.cacheTtlSeconds * 1000
});

/**
 * Requests currently in flight, keyed identically to the cache.
 *
 * A cold viewport pan fires many concurrent requests, and several browsers can request the same tile
 * at once. Without this, each would independently hit Martin.
 */
const inflight = new Map<string, Promise<CachedTile>>();

/**
 * Build a cache key.
 *
 * The context identifier is the first component, which is what keeps authorization contexts
 * isolated: two callers with different access can never collide on a key, so a cached tile is never
 * served to someone whose context did not produce it. The source version lets a deploy invalidate
 * every entry at once.
 *
 * @param {string} contextId
 * @param {string} source
 * @param {number} z
 * @param {number} x
 * @param {number} y
 * @return {*}  {string}
 */
export const buildCacheKey = (contextId: string, source: string, z: number, x: number, y: number): string => {
  return `${contextId}|${config.sourceVersion}|${source}|${z}|${x}|${y}`;
};

export const getCachedTile = (key: string): CachedTile | undefined => cache.get(key);

export const setCachedTile = (key: string, value: CachedTile) => {
  cache.set(key, value);
};

/**
 * Resolve a tile through the cache, collapsing concurrent misses for the same key into one upstream
 * request.
 *
 * @param {string} key
 * @param {() => Promise<CachedTile>} loader
 * @return {*}  {Promise<{ tile: CachedTile; hit: boolean }>}
 */
export const resolveTile = async (
  key: string,
  loader: () => Promise<CachedTile>
): Promise<{ tile: CachedTile; hit: boolean }> => {
  const cached = cache.get(key);

  if (cached) {
    return { tile: cached, hit: true };
  }

  const pending = inflight.get(key);

  if (pending) {
    // Counted as a hit: it was served without an additional upstream request.
    return { tile: await pending, hit: true };
  }

  const promise = loader()
    .then((tile) => {
      // Only cache successful and empty tiles. Errors must not be sticky.
      if (tile.status === 200 || tile.status === 204) {
        cache.set(key, tile);
      }

      return tile;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);

  return { tile: await promise, hit: false };
};

/**
 * Clear the cache. Test seam.
 */
export const clearTileCache = () => {
  cache.clear();
  inflight.clear();
};

export const getCacheStats = () => ({ entries: cache.size, bytes: cache.calculatedSize ?? 0 });

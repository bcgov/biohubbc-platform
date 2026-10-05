import { BC_BASEMAP_CLASSIFICATION_LIMIT } from 'constants/basemap';

/** What the BC basemap service holds for a tile: a map image, or nothing usable (a 404 or a blank tile). */
export type BcBasemapTileClassification = 'content' | 'missing';

/**
 * Classifications keyed by tile, in insertion order so the oldest can be evicted first. What the service holds for a
 * tile does not change within a page's lifetime, so entries never expire; size is the only bound.
 */
const classifications = new Map<string, BcBasemapTileClassification>();

const listeners = new Set<() => void>();

/**
 * Key a tile is recorded under.
 *
 * @param {{ z: number; x: number; y: number }} tile
 * @return {*}  {string}
 */
export const bcTileKey = (tile: { z: number; x: number; y: number }): string => `${tile.z}/${tile.x}/${tile.y}`;

/**
 * Record what the service holds for a tile, and tell subscribers when that is news.
 *
 * @param {string} key - From {@link bcTileKey}.
 * @param {BcBasemapTileClassification} classification
 */
export const recordBcTileClassification = (key: string, classification: BcBasemapTileClassification): void => {
  if (classifications.get(key) === classification) {
    return;
  }

  classifications.delete(key);
  classifications.set(key, classification);

  if (classifications.size > BC_BASEMAP_CLASSIFICATION_LIMIT) {
    const oldest = classifications.keys().next().value;

    if (oldest !== undefined) {
      classifications.delete(oldest);
    }
  }

  for (const listener of listeners) {
    listener();
  }
};

/**
 * What the service is known to hold for a tile, or undefined while the tile has not been fetched.
 *
 * @param {string} key - From {@link bcTileKey}.
 * @return {*}  {(BcBasemapTileClassification | undefined)}
 */
export const findBcTileClassification = (key: string): BcBasemapTileClassification | undefined =>
  classifications.get(key);

/**
 * Be told whenever a tile's classification is recorded or changes.
 *
 * @param {() => void} listener
 * @return {*}  {() => void} Unsubscribes.
 */
export const subscribeToBcTileClassifications = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Forget every classification. For tests, which share the module-level registry.
 */
export const clearBcTileClassifications = (): void => {
  classifications.clear();
};

/**
 * Tile sources published by Martin.
 *
 * A token is minted against exactly one source and the gateway rejects it for any other, so these
 * values are part of the authorization contract rather than cosmetic labels. Each must match the
 * source id Martin publishes (see the `functions` block in `infrastructure/martin/values.yaml` and
 * the equivalent `martin-config` entry in `compose.yml`) and appear in the gateway's
 * `MARTIN_ALLOWED_SOURCES` allowlist.
 */
export enum MARTIN_SOURCE {
  /** Authorized search-result tiles: `biohub.martin_search`. */
  SEARCH = 'search',
  /** One submission feature's spatial properties: `biohub.martin_feature`. */
  FEATURE = 'feature'
}

/** Layer name `biohub.martin_feature` encodes into its tiles. */
export const MARTIN_FEATURE_SOURCE_LAYER = 'geometries';

/** Zoom range the `feature` source is published at. Keep in sync with the Martin function source config. */
export const MARTIN_FEATURE_MIN_ZOOM = 0;
export const MARTIN_FEATURE_MAX_ZOOM = 15;

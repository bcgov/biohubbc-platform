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
  SEARCH = 'search'
}

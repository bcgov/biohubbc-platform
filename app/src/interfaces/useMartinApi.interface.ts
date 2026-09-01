/**
 * A Martin session the map can render.
 */
export interface IMartinSession {
  /**
   * Short lived tile token. Held in memory and attached as a Bearer token on tile requests; it must never appear in
   * a URL, where it would be visible in the address bar, history and referrer headers.
   */
  token: string;
  token_type: 'Bearer';
  /** Token lifetime in seconds. The session is refreshed before this elapses. */
  token_expires_in: number;
  /** Remaining lifetime of the underlying authorization context, in seconds. */
  context_expires_in: number;
  /** Tile source the token grants access to. */
  source: string;
  /**
   * Opaque tile context id. Stable across token refreshes and changes when the search does, which makes it the right
   * client-side cache key for the tile URL.
   */
  martin_context_id: string;
  /** Tile URL template for MapLibre, e.g. `/martin/search/{z}/{x}/{y}`. */
  martin_url_template: string;
  /** True when the search matched secured features the caller cannot see. */
  has_more_secured_features: boolean;
}

/**
 * A tile session for a single submission feature's spatial properties.
 */
export interface ISubmissionFeatureTileSession {
  has_spatial_properties: true;
  /**
   * Short lived tile token. Held in memory and attached as a Bearer token on tile requests; it must never appear in
   * a URL, where it would be visible in the address bar, history and referrer headers.
   */
  token: string;
  token_type: 'Bearer';
  /** Token lifetime in seconds. The session is refreshed before this elapses. */
  token_expires_in: number;
  /** Tile source the token grants access to. */
  source: string;
  /** Layer name inside the vector tiles. Required to configure a MapLibre layer against the source. */
  source_layer: string;
  /** Tile URL template for MapLibre, e.g. `/martin/feature/{z}/{x}/{y}`. */
  martin_url_template: string;
  /** Combined extent of the feature's spatial properties as `[minX, minY, maxX, maxY]` in WGS84. */
  bbox: [number, number, number, number];
  /** Lowest zoom the tile source serves. */
  min_zoom: number;
  /** Highest zoom the tile source serves. */
  max_zoom: number;
}

/**
 * A feature with nothing to map. No token is issued, so no tiles can be requested.
 */
export interface ISubmissionFeatureTileSessionEmpty {
  has_spatial_properties: false;
}

export type CreateSubmissionFeatureTileSessionResponse =
  | ISubmissionFeatureTileSession
  | ISubmissionFeatureTileSessionEmpty;

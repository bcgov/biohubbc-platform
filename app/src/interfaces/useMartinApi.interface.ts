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
  has_inaccessible_secured_features: boolean;
}

/**
 * A tile session for a subject with a fixed extent: a single submission feature's spatial properties, or the spatial
 * properties of every active feature of a submission upload.
 */
export interface ITileExtentSession {
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
  /** Combined extent of the mapped spatial properties as `[minX, minY, maxX, maxY]` in WGS84. */
  bbox: [number, number, number, number];
  /** Lowest zoom the tile source serves. */
  min_zoom: number;
  /** Highest zoom the tile source serves. */
  max_zoom: number;
}

/**
 * A subject with nothing to map. No token is issued, so no tiles can be requested.
 */
export interface ITileExtentSessionEmpty {
  has_spatial_properties: false;
}

export type CreateTileExtentSessionResponse = ITileExtentSession | ITileExtentSessionEmpty;

/** A tile session for a single submission feature's spatial properties. */
export type ISubmissionFeatureTileSession = ITileExtentSession;

/** A feature with nothing to map. */
export type ISubmissionFeatureTileSessionEmpty = ITileExtentSessionEmpty;

export type CreateSubmissionFeatureTileSessionResponse = CreateTileExtentSessionResponse;

/** A tile session for the spatial properties of every active feature of a submission upload. */
export type ISubmissionUploadTileSession = ITileExtentSession;

/** An upload with nothing to map. */
export type ISubmissionUploadTileSessionEmpty = ITileExtentSessionEmpty;

export type CreateSubmissionUploadTileSessionResponse = CreateTileExtentSessionResponse;

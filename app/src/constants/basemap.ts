/**
 * Extent of the BC Government basemap tile cache as `[west, south, east, north]` in WGS84, converted from the
 * service's published Web Mercator `fullExtent`. Outside it the service answers 404. Inside it, wherever the
 * service holds no data, it answers a uniform grey tile with HTTP 200 instead, so a tile inside the extent is only
 * known to be usable once its pixels have been read.
 */
export const BC_BASEMAP_COVERAGE_BBOX: [number, number, number, number] = [-149.3343, 44.6472, -103.1591, 63.5881];

/** Zoom range the cache is built for, from the service's `minScale` and `maxScale`. Other levels are not cached. */
export const BC_BASEMAP_MIN_ZOOM = 4;

export const BC_BASEMAP_MAX_ZOOM = 17;

export const BC_BASEMAP_TILE_SIZE = 256;

/** RGB of the tile the service returns inside its extent where it holds no data. */
export const BC_BASEMAP_BLANK_TILE_RGB: [number, number, number] = [204, 204, 204];

/** Per-channel tolerance around the blank colour, absorbing JPEG quantisation. */
export const BC_BASEMAP_BLANK_TILE_TOLERANCE = 2;

/** Pixel stride of the classification sample grid: every 32nd pixel on both axes of a 256px tile, 64 samples. */
export const BC_BASEMAP_SAMPLE_STEP = 32;

/**
 * Cap on remembered tile classifications. MapLibre serves a tile it already holds without asking the protocol again,
 * so a classification evicted here would leave that tile unknown for as long as MapLibre keeps it. The cap therefore
 * sits well above MapLibre's own tile cache, which holds a few viewports' worth of tiles.
 */
export const BC_BASEMAP_CLASSIFICATION_LIMIT = 4096;

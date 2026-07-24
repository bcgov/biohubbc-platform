import { MAP_MAX_ZOOM, MAP_MIN_ZOOM } from 'constants/spatial';
import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';

export const BASEMAP_SOURCE_ID = 'basemap';
export const SEARCH_RESULTS_SOURCE_ID = 'search-results';

export const BASEMAP_LAYER_ID = 'basemap';
export const CLUSTER_LAYER_ID = 'search-clusters';
export const POINT_LAYER_ID = 'search-points';
export const LINE_LAYER_ID = 'search-lines';
export const FILL_LAYER_ID = 'search-fills';
export const OUTLINE_LAYER_ID = 'search-outlines';

/** Layers a click can select a feature from. The cluster layer is display only. */
export const INTERACTIVE_LAYER_IDS = [FILL_LAYER_ID, LINE_LAYER_ID, POINT_LAYER_ID];

/** Source layers produced by the tile function: aggregated counts at low zoom, raw features above it. */
const CLUSTERS_SOURCE_LAYER = 'clusters';
const FEATURES_SOURCE_LAYER = 'features';

const RESULT_COLOR = '#1f6fb2';
/** Secured features are visible only to callers granted access, so they are called out distinctly. */
const SECURED_COLOR = '#b35c00';

/** Colour by whether the feature is secured, using the only styling property the tiles carry. */
const colorBySecured = ['case', ['get', 'is_secured'], SECURED_COLOR, RESULT_COLOR];

/**
 * Build the raster basemap source.
 *
 * @param {string} basemapUrl - Tile URL template from app config.
 * @param {string} attribution - Attribution text required by the basemap provider.
 * @return {*}  {SourceSpecification}
 */
export const buildBasemapSource = (basemapUrl: string, attribution: string): SourceSpecification => ({
  type: 'raster',
  tiles: [basemapUrl],
  tileSize: 256,
  attribution
});

/**
 * Build the search-result vector tile source.
 *
 * The tile URL template is returned by the API and is relative, so it resolves against the app's own origin: the same
 * path is served by the dev server proxy locally and by an OpenShift route when deployed.
 *
 * The context id is appended purely as a client-side cache key. Tiles are authorized by the token in the request
 * header, and the gateway discards every client-supplied query parameter, so this changes nothing server side. Without
 * it the URL would be identical across searches and the browser would serve a previous search's tiles from cache.
 *
 * @param {string} martinUrlTemplate - Template from the Martin session, e.g. `/martin/search/{z}/{x}/{y}`.
 * @param {string} contextId - Opaque tile context id, used only to vary the URL.
 * @return {*}  {SourceSpecification}
 */
export const buildSearchResultsSource = (martinUrlTemplate: string, contextId: string): SourceSpecification => {
  const absoluteTemplate = martinUrlTemplate.startsWith('http')
    ? martinUrlTemplate
    : `${window.location.origin}${martinUrlTemplate}`;

  const separator = absoluteTemplate.includes('?') ? '&' : '?';

  return {
    type: 'vector',
    tiles: [`${absoluteTemplate}${separator}ctx=${encodeURIComponent(contextId)}`],
    minzoom: MAP_MIN_ZOOM,
    maxzoom: MAP_MAX_ZOOM
  };
};

/**
 * Build the layers rendering the search results.
 *
 * Ordered so areas sit beneath lines, and lines beneath points; the basemap is added by the caller before these.
 *
 * @return {*}  {LayerSpecification[]}
 */
export const buildSearchResultLayers = (): LayerSpecification[] => [
  {
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SEARCH_RESULTS_SOURCE_ID,
    'source-layer': FEATURES_SOURCE_LAYER,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'fill-color': colorBySecured as never,
      'fill-opacity': 0.25
    }
  },
  {
    id: OUTLINE_LAYER_ID,
    type: 'line',
    source: SEARCH_RESULTS_SOURCE_ID,
    'source-layer': FEATURES_SOURCE_LAYER,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: {
      'line-color': colorBySecured as never,
      'line-width': 1.5
    }
  },
  {
    id: LINE_LAYER_ID,
    type: 'line',
    source: SEARCH_RESULTS_SOURCE_ID,
    'source-layer': FEATURES_SOURCE_LAYER,
    filter: ['==', ['geometry-type'], 'LineString'],
    paint: {
      'line-color': colorBySecured as never,
      'line-width': 2
    }
  },
  {
    id: POINT_LAYER_ID,
    type: 'circle',
    source: SEARCH_RESULTS_SOURCE_ID,
    'source-layer': FEATURES_SOURCE_LAYER,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': colorBySecured as never,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
    }
  },
  {
    // Low zoom aggregate. Counts are encoded as size and colour rather than labels, because text layers need a glyph
    // endpoint that this stack does not provide.
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: SEARCH_RESULTS_SOURCE_ID,
    'source-layer': CLUSTERS_SOURCE_LAYER,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 6, 10, 12, 100, 18, 1000, 26] as never,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['get', 'count'],
        1,
        '#7fb2d9',
        100,
        RESULT_COLOR,
        1000,
        '#0b3f6b'
      ] as never,
      'circle-opacity': 0.85,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
    }
  }
];

/**
 * Build the basemap layer.
 *
 * @return {*}  {LayerSpecification}
 */
export const buildBasemapLayer = (): LayerSpecification => ({
  id: BASEMAP_LAYER_ID,
  type: 'raster',
  source: BASEMAP_SOURCE_ID
});

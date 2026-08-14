import type { ISlippyMapLayer } from 'components/map/SlippyMap.interface';
import type { SourceSpecification } from 'maplibre-gl';

export const FEATURE_GEOMETRIES_SOURCE_ID = 'feature-geometries';

export const FEATURE_POINT_LAYER_ID = 'feature-points';
export const FEATURE_LINE_LAYER_ID = 'feature-lines';
export const FEATURE_FILL_LAYER_ID = 'feature-fills';
export const FEATURE_OUTLINE_LAYER_ID = 'feature-outlines';

const GEOMETRY_COLOR = '#1f6fb2';

/**
 * Build the vector tile source for a feature's spatial properties.
 *
 * The tile URL template is returned by the API and is relative, so it resolves against the app's own origin: the same
 * path is served by the dev server proxy locally and by an OpenShift route when deployed.
 *
 * The cache key is appended purely as a client-side cache buster. Tiles are authorized by the token in the request
 * header, and the gateway discards every client-supplied query parameter, so this changes nothing server side. Without
 * it the URL would be identical across features and the browser would serve the previous feature's tiles from cache.
 *
 * @param {string} martinUrlTemplate - Template from the tile session, e.g. `/martin/feature/{z}/{x}/{y}`.
 * @param {string} cacheKey - Identifies the feature being mapped, used only to vary the URL.
 * @param {number} minZoom - Lowest zoom the source serves.
 * @param {number} maxZoom - Highest zoom the source serves.
 * @return {*}  {SourceSpecification}
 */
export const buildFeatureTileSource = (
  martinUrlTemplate: string,
  cacheKey: string,
  minZoom: number,
  maxZoom: number
): SourceSpecification => {
  const absoluteTemplate = martinUrlTemplate.startsWith('http')
    ? martinUrlTemplate
    : `${window.location.origin}${martinUrlTemplate}`;

  const separator = absoluteTemplate.includes('?') ? '&' : '?';

  return {
    type: 'vector',
    tiles: [`${absoluteTemplate}${separator}ctx=${encodeURIComponent(cacheKey)}`],
    minzoom: minZoom,
    maxzoom: maxZoom
  };
};

/**
 * Build the layers rendering a feature's spatial properties.
 *
 * A feature's spatial properties can be of mixed geometry types, and they all arrive in one source layer, so each
 * layer filters by geometry type: a layer type only renders the geometries it can draw, and without the filters a
 * point among polygons would silently not appear. `geometry-type` reports multi-geometries under their singular name,
 * so these four layers also cover MultiPoint, MultiLineString and MultiPolygon.
 *
 * Ordered so areas sit beneath lines, and lines beneath points; the basemap is added by the caller before these.
 *
 * All of them are display-only: feature tiles carry geometry alone, so there is nothing a click could resolve to.
 *
 * @param {string} sourceLayer - Layer name inside the vector tiles, from the tile session.
 * @return {*}  {ISlippyMapLayer[]}
 */
export const buildFeatureLayers = (sourceLayer: string): ISlippyMapLayer[] => [
  {
    specification: {
      id: FEATURE_FILL_LAYER_ID,
      type: 'fill',
      source: FEATURE_GEOMETRIES_SOURCE_ID,
      'source-layer': sourceLayer,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': GEOMETRY_COLOR,
        'fill-opacity': 0.25
      }
    }
  },
  {
    specification: {
      id: FEATURE_OUTLINE_LAYER_ID,
      type: 'line',
      source: FEATURE_GEOMETRIES_SOURCE_ID,
      'source-layer': sourceLayer,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': GEOMETRY_COLOR,
        'line-width': 1.5
      }
    }
  },
  {
    specification: {
      id: FEATURE_LINE_LAYER_ID,
      type: 'line',
      source: FEATURE_GEOMETRIES_SOURCE_ID,
      'source-layer': sourceLayer,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': GEOMETRY_COLOR,
        'line-width': 2
      }
    }
  },
  {
    specification: {
      id: FEATURE_POINT_LAYER_ID,
      type: 'circle',
      source: FEATURE_GEOMETRIES_SOURCE_ID,
      'source-layer': sourceLayer,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 5,
        'circle-color': GEOMETRY_COLOR,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    }
  }
];

import { Feature } from 'geojson';

export const MAP_DEFAULT_ZOOM = 6;

/**
 * Furthest a map may zoom OUT. It has to clear all of British Columbia: the province spans roughly
 * 42 degrees of longitude, which needs zoom 4 to fit a typical panel. A higher floor would open an
 * unfiltered search on a fraction of the province with no way to see the rest, since the floor also
 * stops the user zooming back out.
 *
 * This is the client floor only. The tile server deliberately serves a wider range (see
 * `gateway.minZoom` in infrastructure/martin/values.yaml), so this can be lowered without a
 * server-side change — at the cost of more expensive low-zoom cluster queries.
 */
export const MAP_MIN_ZOOM = 4;

export const MAP_MAX_ZOOM = 15;

/**
 * Highest zoom a map may open at when fitting an extent. An extent with no area — a feature recorded
 * as a single point, or a search that matched one — would otherwise be fitted literally and open at
 * the maximum zoom, showing the result with no surroundings to place it against. Capping the initial
 * fit leaves the user zoomed out far enough to recognise where they are; they can still zoom in to
 * `MAP_MAX_ZOOM` afterwards.
 */
export const MAP_FIT_MAX_ZOOM = 14;

/** Padding in pixels kept between a fitted extent and the edge of the map. */
export const MAP_FIT_PADDING = 40;

/**
 * Shortest the search-result map view may be, in pixels. It grows to fill the result panel, but the panel is a flex
 * container: without a floor the map would collapse to nothing on a short viewport.
 */
export const MAP_VIEW_MIN_HEIGHT = 500;

/**
 * Height of a map embedded as one section of a page, in pixels. Fixed rather than grown to fit: the section sits
 * among others that the user scrolls through, so the map takes a predictable share of the page rather than the rest
 * of it.
 */
export const MAP_SECTION_HEIGHT = 400;

/** Height of the submission feature detail map, in pixels. */
export const SUBMISSION_FEATURE_MAP_SECTION_HEIGHT = 320;

/**
 * Zoom levels added when the user zooms into a cluster from its popper. Server-side clusters carry no expansion
 * zoom, so a fixed increment is used; each level doubles the clustering grid's resolution. Always capped at
 * `MAP_MAX_ZOOM`.
 */
export const MAP_CLUSTER_ZOOM_INCREMENT = 2;

export const ALL_OF_BC_BOUNDARY: Feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-146.95401365536304, 44.62175409623327],
        [-146.95401365536304, 63.528970541102794],
        [-105.07413084286304, 63.528970541102794],
        [-105.07413084286304, 44.62175409623327],
        [-146.95401365536304, 44.62175409623327]
      ]
    ]
  }
};

/**
 * Extent of {@link ALL_OF_BC_BOUNDARY} as `[minX, minY, maxX, maxY]` in WGS84, for map viewports
 * that open on the whole province.
 */
export const ALL_OF_BC_BBOX: [number, number, number, number] = (() => {
  const geometry = ALL_OF_BC_BOUNDARY.geometry;

  if (geometry.type !== 'Polygon') {
    // The constant is a Polygon; this is only here so a future change to it fails loudly rather than silently.
    return [-139, 48, -114, 60];
  }

  const [ring] = geometry.coordinates;
  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);

  return [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)];
})();

export enum SPATIAL_COMPONENT_TYPE {
  OCCURRENCE = 'Occurrence',
  BOUNDARY = 'Boundary',
  BOUNDARY_CENTROID = 'Boundary Centroid'
}

export enum LAYER_NAME {
  OCCURRENCES = 'Occurrences',
  BOUNDARIES = 'Boundaries',
  SURVEYS = 'Surveys'
}

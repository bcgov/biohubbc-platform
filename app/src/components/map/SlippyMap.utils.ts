import type { Feature } from 'geojson';
import { isEqual, omit } from 'lodash-es';
import type { Map as MapLibreMap, SourceSpecification, StyleSpecification } from 'maplibre-gl';
import type { GeoJSONStoreFeatures } from 'terra-draw';
import { v4, validate, version } from 'uuid';
import type { ISlippyMapDrawControls, ISlippyMapTile, SlippyMapDrawMode } from './SlippyMap.interface';

/**
 * Default `SlippyMap` style: a blank neutral background that makes no external network requests.
 */
export const SLIPPY_MAP_DEFAULT_STYLE: StyleSpecification = {
  version: 8,
  name: 'blank',
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#e9e9e9' }
    }
  ]
};

/**
 * Maps GeoJSON geometry types to the draw mode responsible for rendering/editing them.
 */
const GEOMETRY_TYPE_TO_DRAW_MODE: Partial<Record<Feature['geometry']['type'], SlippyMapDrawMode>> = {
  Point: 'point',
  LineString: 'linestring',
  Polygon: 'polygon'
};

/**
 * Set of draw mode names, used to identify real (consumer) features in a snapshot in O(1).
 */
const DRAW_MODE_NAMES = new Set<string>(Object.values(GEOMETRY_TYPE_TO_DRAW_MODE));

/**
 * Feature properties that terra-draw uses to flag its internal helper features (selection points, mid points,
 * closing points, etc) and transient feature states (a shape mid-draw). Features with any of these flags set are
 * not consumer features.
 */
const TERRA_DRAW_HELPER_FLAG_PROPERTIES = [
  'midPoint',
  'selectionPoint',
  'closingPoint',
  'snappingPoint',
  'coordinatePoint',
  'currentlyDrawing',
  'edited'
];

/**
 * Feature properties used internally by terra-draw that should not leak to consumers.
 */
const TERRA_DRAW_INTERNAL_PROPERTIES = [
  'mode',
  'selected',
  'selectionPointFeatureId',
  'coordinatePointFeatureId',
  'coordinatePointIds',
  'provisionalCoordinateCount',
  'committedCoordinateCount',
  'marker',
  ...TERRA_DRAW_HELPER_FLAG_PROPERTIES
];

/**
 * Checks whether the feature has a geometry type that the map's drawing library can display and edit.
 *
 * @param {Feature} feature GeoJSON feature to check.
 * @return {boolean} `true` if the feature can be displayed on the map.
 */
export const isSupportedDrawFeature = (feature: Feature): boolean => {
  return Boolean(GEOMETRY_TYPE_TO_DRAW_MODE[feature.geometry.type]);
};

/**
 * Returns a feature id compatible with the drawing library's id requirements (UUID v4), preserving the incoming id
 * when it is already a valid UUID v4 so that features round-trip with stable ids.
 *
 * @param {Feature['id']} id Incoming feature id, if any.
 * @return {string} A UUID v4 feature id.
 */
const getDrawFeatureId = (id: Feature['id']): string => {
  return typeof id === 'string' && validate(id) && version(id) === 4 ? id : v4();
};

/**
 * Prepares arbitrary external GeoJSON features for display/editing on the map: features with unsupported geometry
 * types are skipped, each supported feature is stamped with the draw mode matching its geometry type, and feature
 * ids are preserved when valid or generated otherwise.
 *
 * @param {Feature[]} features External GeoJSON features.
 * @return {{ normalized: GeoJSONStoreFeatures[]; skipped: Feature[] }} Features ready for the drawing library, and
 * any skipped (unsupported) features.
 */
export const normalizeFeaturesForDraw = (
  features: Feature[]
): { normalized: GeoJSONStoreFeatures[]; skipped: Feature[] } => {
  const normalized: GeoJSONStoreFeatures[] = [];
  const skipped: Feature[] = [];

  for (const feature of features) {
    const mode = GEOMETRY_TYPE_TO_DRAW_MODE[feature.geometry.type];

    if (!mode) {
      skipped.push(feature);
      continue;
    }

    normalized.push({
      ...feature,
      id: getDrawFeatureId(feature.id),
      properties: { ...feature.properties, mode }
    } as GeoJSONStoreFeatures);
  }

  return { normalized, skipped };
};

/**
 * Extracts consumer-facing features from a terra-draw snapshot: drops the library's internal helper features
 * (selection points, mid points) and strips internal properties, while keeping ids, geometry, and consumer
 * properties.
 *
 * @param {GeoJSONStoreFeatures[]} snapshot Snapshot features from the drawing library.
 * @return {Feature[]} Clean GeoJSON features safe to expose to consumers.
 */
export const extractSnapshotFeatures = (snapshot: GeoJSONStoreFeatures[]): Feature[] => {
  return snapshot
    .filter((feature) => {
      const properties = feature.properties ?? {};
      return (
        DRAW_MODE_NAMES.has(properties['mode'] as string) &&
        !TERRA_DRAW_HELPER_FLAG_PROPERTIES.some((flag) => properties[flag])
      );
    })
    .map((feature) => {
      return {
        type: 'Feature' as const,
        id: feature.id,
        geometry: feature.geometry,
        properties: omit(feature.properties ?? {}, TERRA_DRAW_INTERNAL_PROPERTIES)
      };
    });
};

/**
 * Projects a feature to the same comparable shape as `extractSnapshotFeatures` output (internal drawing properties
 * removed), for change detection.
 *
 * @param {Feature} feature GeoJSON feature.
 * @return {Feature} The comparable feature.
 */
export const toComparableFeature = (feature: Feature): Feature => {
  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: omit(feature.properties ?? {}, TERRA_DRAW_INTERNAL_PROPERTIES)
  };
};

/**
 * Compares an external feature set against features extracted from the drawing library, ignoring internal drawing
 * properties on either side. Used to skip re-syncing the map when the consumer passes back the features that the
 * map itself emitted.
 *
 * @param {Feature[]} externalFeatures Features provided by the consumer.
 * @param {Feature[]} snapshotFeatures Features currently displayed, per `extractSnapshotFeatures`.
 * @return {boolean} `true` if both sets are equivalent.
 */
export const areFeatureSetsEqual = (externalFeatures: Feature[], snapshotFeatures: Feature[]): boolean => {
  return isEqual(externalFeatures.map(toComparableFeature), snapshotFeatures.map(toComparableFeature));
};

/**
 * Checks whether at least one drawing control is enabled.
 *
 * @param {ISlippyMapDrawControls} [drawControls] Draw controls configuration.
 * @return {boolean} `true` if any control is enabled.
 */
export const hasEnabledDrawControl = (drawControls?: ISlippyMapDrawControls): boolean => {
  return Boolean(
    drawControls && (drawControls.point || drawControls.lineString || drawControls.polygon || drawControls.trash)
  );
};

/**
 * The draw control that enables each draw mode.
 *
 * The two vocabularies differ (the drawing library's `linestring` against the control's `lineString`), so the mapping
 * is held here rather than derived at each use site: the toolbar and the mode effect must agree on which modes are
 * reachable, or a mode stays active with no button to leave it by.
 */
export const DRAW_MODE_CONTROL_KEYS: Record<SlippyMapDrawMode, keyof ISlippyMapDrawControls> = {
  point: 'point',
  linestring: 'lineString',
  polygon: 'polygon'
};

/**
 * Checks whether a drawing mode is reachable under the given controls.
 *
 * Accepts any mode string, so a mode read back from the drawing library (which also reports `select` and `static`)
 * can be tested without narrowing it first.
 *
 * @param {string} mode Drawing mode to test.
 * @param {ISlippyMapDrawControls} [drawControls] Draw controls configuration.
 * @return {boolean} `true` if the mode is a draw mode whose control is enabled.
 */
export const isDrawModeEnabled = (mode: string, drawControls?: ISlippyMapDrawControls): boolean => {
  if (!Object.hasOwn(DRAW_MODE_CONTROL_KEYS, mode)) {
    return false;
  }

  return Boolean(drawControls?.[DRAW_MODE_CONTROL_KEYS[mode as SlippyMapDrawMode]]);
};

/**
 * Web Mercator X of a longitude, as a fraction of the world's width.
 *
 * @param {number} longitude
 * @return {*}  {number}
 */
const mercatorXFromLongitude = (longitude: number): number => (180 + longitude) / 360;

/**
 * Web Mercator Y of a latitude, as a fraction of the world's height measured from the north.
 *
 * @param {number} latitude
 * @return {*}  {number}
 */
const mercatorYFromLatitude = (latitude: number): number =>
  (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360))) / 360;

/**
 * Whether a tile intersects a source's `bounds`, by MapLibre's own rule: the bounds are clamped to the world and a
 * tile that merely touches them counts. Matching that rule is what makes this agree with the tiles MapLibre actually
 * requests from a bounded source.
 *
 * @param {{ z: number; x: number; y: number }} tile
 * @param {[number, number, number, number]} [bounds] - `[west, south, east, north]`. Without bounds every tile counts.
 * @return {*}  {boolean}
 */
export const isTileWithinBounds = (
  tile: { z: number; x: number; y: number },
  bounds?: [number, number, number, number]
): boolean => {
  if (!bounds) {
    return true;
  }

  const west = Math.max(-180, bounds[0]);
  const south = Math.max(-90, bounds[1]);
  const east = Math.min(180, bounds[2]);
  const north = Math.min(90, bounds[3]);
  const worldSize = 2 ** tile.z;

  const minX = Math.floor(mercatorXFromLongitude(west) * worldSize);
  const maxX = Math.ceil(mercatorXFromLongitude(east) * worldSize);
  const minY = Math.floor(mercatorYFromLatitude(north) * worldSize);
  const maxY = Math.ceil(mercatorYFromLatitude(south) * worldSize);

  return tile.x >= minX && tile.x < maxX && tile.y >= minY && tile.y < maxY;
};

/**
 * The tiles a source needs at the map's current viewport, as MapLibre itself computes them.
 *
 * Raster sources round the tile zoom while vector sources floor it, and the tile size and zoom range are read from
 * the specification rather than the live source: a source only learns its bounds once its own load completes, which
 * need not have happened when the map reports its first viewport.
 *
 * @param {Pick<MapLibreMap, 'coveringTiles'>} map
 * @param {SourceSpecification} [source] - The applied source's specification.
 * @return {*}  {ISlippyMapTile[]} Empty for a source that is not tiled.
 */
export const coveringTilesForSource = (
  map: Pick<MapLibreMap, 'coveringTiles'>,
  source: SourceSpecification | undefined
): ISlippyMapTile[] => {
  if (!source || (source.type !== 'raster' && source.type !== 'raster-dem' && source.type !== 'vector')) {
    return [];
  }

  const tileIds = map.coveringTiles({
    tileSize: 'tileSize' in source && source.tileSize ? source.tileSize : 512,
    minzoom: source.minzoom ?? 0,
    maxzoom: source.maxzoom ?? 22,
    roundZoom: source.type !== 'vector'
  });

  // Keyed by canonical tile: a world that repeats across the antimeridian yields the same tile more than once.
  const tiles = new Map<string, ISlippyMapTile>();

  for (const { canonical } of tileIds) {
    const key = `${canonical.z}/${canonical.x}/${canonical.y}`;

    if (!tiles.has(key)) {
      tiles.set(key, {
        z: canonical.z,
        x: canonical.x,
        y: canonical.y,
        withinBounds: isTileWithinBounds(canonical, source.bounds)
      });
    }
  }

  return [...tiles.values()];
};

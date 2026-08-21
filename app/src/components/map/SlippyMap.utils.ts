import type { Feature } from 'geojson';
import { isEqual, omit } from 'lodash-es';
import type { StyleSpecification } from 'maplibre-gl';
import type { GeoJSONStoreFeatures } from 'terra-draw';
import { v4, validate, version } from 'uuid';
import type { ISlippyMapDrawControls, SlippyMapDrawMode } from './SlippyMap.interface';

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

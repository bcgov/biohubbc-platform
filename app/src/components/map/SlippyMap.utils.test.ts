import type { Feature } from 'geojson';
import type { GeoJSONStoreFeatures } from 'terra-draw';
import { validate, version } from 'uuid';
import {
  areFeatureSetsEqual,
  extractSnapshotFeatures,
  hasEnabledDrawControl,
  isSupportedDrawFeature,
  normalizeFeaturesForDraw,
  toComparableFeature
} from './SlippyMap.utils';

const VALID_UUID = 'b7e83b28-63a7-476b-a728-6a2b19cee372';

const getPolygonFeature = (overrides?: Partial<Feature>): Feature => {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0]
        ]
      ]
    },
    properties: { name: 'test polygon' },
    ...overrides
  };
};

describe('SlippyMap.utils', () => {
  describe('isSupportedDrawFeature', () => {
    it('returns true for Point, LineString, and Polygon geometries', () => {
      expect(isSupportedDrawFeature(getPolygonFeature())).toBe(true);
      expect(
        isSupportedDrawFeature({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: null })
      ).toBe(true);
      expect(
        isSupportedDrawFeature({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1]
            ]
          },
          properties: null
        })
      ).toBe(true);
    });

    it('returns false for unsupported geometry types', () => {
      expect(
        isSupportedDrawFeature({
          type: 'Feature',
          geometry: { type: 'MultiPolygon', coordinates: [] },
          properties: null
        })
      ).toBe(false);
    });
  });

  describe('normalizeFeaturesForDraw', () => {
    it('stamps the draw mode matching each geometry type', () => {
      const { normalized } = normalizeFeaturesForDraw([
        getPolygonFeature(),
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: null },
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1]
            ]
          },
          properties: null
        }
      ]);

      expect(normalized.map((feature) => feature.properties?.['mode'])).toEqual(['polygon', 'point', 'linestring']);
    });

    it('preserves valid UUID v4 ids and consumer properties', () => {
      const { normalized } = normalizeFeaturesForDraw([getPolygonFeature({ id: VALID_UUID })]);

      expect(normalized[0].id).toBe(VALID_UUID);
      expect(normalized[0].properties?.['name']).toBe('test polygon');
    });

    it('replaces missing or non-UUID ids with generated UUID v4 ids', () => {
      const { normalized } = normalizeFeaturesForDraw([
        getPolygonFeature(),
        getPolygonFeature({ id: 12345 }),
        getPolygonFeature({ id: 'not-a-uuid' })
      ]);

      for (const feature of normalized) {
        expect(typeof feature.id).toBe('string');
        expect(validate(feature.id as string)).toBe(true);
        expect(version(feature.id as string)).toBe(4);
      }
    });

    it('skips features with unsupported geometry types', () => {
      const multiPolygonFeature: Feature = {
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: [] },
        properties: null
      };

      const { normalized, skipped } = normalizeFeaturesForDraw([getPolygonFeature(), multiPolygonFeature]);

      expect(normalized).toHaveLength(1);
      expect(skipped).toEqual([multiPolygonFeature]);
    });
  });

  describe('extractSnapshotFeatures', () => {
    it('drops helper features and strips internal drawing properties', () => {
      const snapshot = [
        {
          type: 'Feature',
          id: VALID_UUID,
          geometry: getPolygonFeature().geometry,
          properties: { mode: 'polygon', selected: true, edited: false, name: 'test polygon' }
        },
        {
          type: 'Feature',
          id: 'helper-1',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { mode: 'select', selectionPoint: true }
        },
        {
          type: 'Feature',
          id: 'helper-2',
          geometry: { type: 'Point', coordinates: [0.5, 0] },
          properties: { mode: 'select', midPoint: true }
        },
        {
          type: 'Feature',
          id: 'helper-3',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: { mode: 'polygon', closingPoint: true }
        },
        {
          type: 'Feature',
          id: 'helper-4',
          geometry: getPolygonFeature().geometry,
          properties: { mode: 'polygon', currentlyDrawing: true }
        }
      ] as GeoJSONStoreFeatures[];

      const features = extractSnapshotFeatures(snapshot);

      expect(features).toEqual([
        {
          type: 'Feature',
          id: VALID_UUID,
          geometry: getPolygonFeature().geometry,
          properties: { name: 'test polygon' }
        }
      ]);
    });
  });

  describe('areFeatureSetsEqual', () => {
    it('returns true when external features round-trip through normalize and extract', () => {
      const external = getPolygonFeature({ id: VALID_UUID });

      const { normalized } = normalizeFeaturesForDraw([external]);
      const extracted = extractSnapshotFeatures(normalized);

      expect(areFeatureSetsEqual([external], extracted)).toBe(true);
    });

    it('returns false when geometries differ', () => {
      const external = getPolygonFeature({ id: VALID_UUID });
      const other = getPolygonFeature({
        id: VALID_UUID,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [5, 5],
              [6, 5],
              [6, 6],
              [5, 5]
            ]
          ]
        }
      });

      expect(areFeatureSetsEqual([external], [other])).toBe(false);
    });

    it('returns false when feature counts differ', () => {
      expect(areFeatureSetsEqual([getPolygonFeature({ id: VALID_UUID })], [])).toBe(false);
    });
  });

  describe('toComparableFeature', () => {
    it('removes internal drawing properties and keeps consumer properties', () => {
      const comparable = toComparableFeature(
        getPolygonFeature({ id: VALID_UUID, properties: { mode: 'polygon', selected: true, name: 'test polygon' } })
      );

      expect(comparable.properties).toEqual({ name: 'test polygon' });
      expect(comparable.id).toBe(VALID_UUID);
    });
  });

  describe('hasEnabledDrawControl', () => {
    it('returns true when at least one control is enabled', () => {
      expect(hasEnabledDrawControl({ polygon: true })).toBe(true);
      expect(hasEnabledDrawControl({ trash: true })).toBe(true);
    });

    it('returns false when no controls are enabled', () => {
      expect(hasEnabledDrawControl()).toBe(false);
      expect(hasEnabledDrawControl({})).toBe(false);
      expect(hasEnabledDrawControl({ polygon: false, trash: false })).toBe(false);
    });
  });
});

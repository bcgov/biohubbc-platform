import { expect } from 'chai';
import { describe, it } from 'mocha';
import wkx from 'wkx';

import { ParquetFeatureData } from '../models/download';
import { CsvPropertyDefinition } from './csv-utils';
import {
  buildGeoParquetMetadata,
  buildParquetSchema,
  extractGeoJsonGeometry,
  featureToRow,
  geoJsonToWkb,
  propertyTypeToParquetType
} from './parquet-utils';

describe('parquet-utils', () => {
  describe('propertyTypeToParquetType', () => {
    it('should map string to UTF8', () => {
      expect(propertyTypeToParquetType('string')).to.equal('UTF8');
    });

    it('should map number to DOUBLE', () => {
      expect(propertyTypeToParquetType('number')).to.equal('DOUBLE');
    });

    it('should map boolean to BOOLEAN', () => {
      expect(propertyTypeToParquetType('boolean')).to.equal('BOOLEAN');
    });

    it('should map datetime to TIMESTAMP_MILLIS', () => {
      expect(propertyTypeToParquetType('datetime')).to.equal('TIMESTAMP_MILLIS');
    });

    it('should map code to UTF8 (resolved label is a string)', () => {
      expect(propertyTypeToParquetType('code')).to.equal('UTF8');
    });

    it('should map taxon to UTF8 (scientific name is a string)', () => {
      expect(propertyTypeToParquetType('taxon')).to.equal('UTF8');
    });

    it('should map spatial to BYTE_ARRAY (WKB-encoded geometry)', () => {
      expect(propertyTypeToParquetType('spatial')).to.equal('BYTE_ARRAY');
    });

    it('should map array to UTF8 (JSON-stringified fallback)', () => {
      expect(propertyTypeToParquetType('array')).to.equal('UTF8');
    });

    it('should map object to UTF8 (JSON-stringified fallback)', () => {
      expect(propertyTypeToParquetType('object')).to.equal('UTF8');
    });

    it('should map artifact_key to UTF8 (file path string)', () => {
      expect(propertyTypeToParquetType('artifact_key')).to.equal('UTF8');
    });

    it('should default unknown types to UTF8', () => {
      expect(propertyTypeToParquetType('unknown_type')).to.equal('UTF8');
    });
  });

  describe('buildParquetSchema', () => {
    it('should include uuid column for all schemas', () => {
      const schema = buildParquetSchema([]);

      expect(schema.fields['uuid']).to.exist;
    });

    it('should always include parent_uuid as nullable column', () => {
      const schema = buildParquetSchema([]);

      expect(schema.fields['parent_uuid']).to.exist;
    });

    it('should add spatial properties as named BYTE_ARRAY columns', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];
      const schema = buildParquetSchema(properties);

      expect(schema.fields['geometry']).to.exist;
    });

    it('should not add geometry column when no spatial properties exist', () => {
      const schema = buildParquetSchema([]);

      expect(schema.fields['geometry']).to.not.exist;
    });

    it('should create a named column for each spatial property', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' },
        { feature_property_name: 'centroid', feature_property_type_name: 'spatial' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];
      const schema = buildParquetSchema(properties);

      expect(schema.fields['name']).to.exist;
      expect(schema.fields['count']).to.exist;
      expect(schema.fields['geometry']).to.exist;
      expect(schema.fields['centroid']).to.exist;
    });

    it('should create columns for mixed property types', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'title', feature_property_type_name: 'string' },
        { feature_property_name: 'value', feature_property_type_name: 'number' },
        { feature_property_name: 'active', feature_property_type_name: 'boolean' },
        { feature_property_name: 'created', feature_property_type_name: 'datetime' },
        { feature_property_name: 'status', feature_property_type_name: 'code' },
        { feature_property_name: 'species', feature_property_type_name: 'taxon' },
        { feature_property_name: 'tags', feature_property_type_name: 'array' },
        { feature_property_name: 'meta', feature_property_type_name: 'object' },
        { feature_property_name: 'file', feature_property_type_name: 'artifact_key' }
      ];
      const schema = buildParquetSchema(properties);

      expect(schema.fields['title']).to.exist;
      expect(schema.fields['value']).to.exist;
      expect(schema.fields['active']).to.exist;
      expect(schema.fields['created']).to.exist;
      expect(schema.fields['status']).to.exist;
      expect(schema.fields['species']).to.exist;
      expect(schema.fields['tags']).to.exist;
      expect(schema.fields['meta']).to.exist;
      expect(schema.fields['file']).to.exist;
    });
  });

  describe('featureToRow', () => {
    const makeFeature = (data: Record<string, unknown>, parentUuid: string | null = null): ParquetFeatureData => ({
      submission_feature_id: 1,
      uuid: 'abc-123',
      feature_type_name: 'observation',
      data,
      parent_uuid: parentUuid
    });

    it('should include uuid in every row', () => {
      const feature = makeFeature({});
      const row = featureToRow(feature, []);

      expect(row['uuid']).to.equal('abc-123');
    });

    it('should always include parent_uuid', () => {
      const feature = makeFeature({}, 'parent-456');
      const row = featureToRow(feature, []);

      expect(row).to.have.property('parent_uuid', 'parent-456');
    });

    it('should set parent_uuid to null when feature has no parent', () => {
      const feature = makeFeature({}, null);
      const row = featureToRow(feature, []);

      expect(row).to.have.property('parent_uuid', null);
    });

    it('should pass through string values directly', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];
      const row = featureToRow(makeFeature({ name: 'Bear' }), properties);

      expect(row['name']).to.equal('Bear');
    });

    it('should pass through number values directly', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];
      const row = featureToRow(makeFeature({ count: 42 }), properties);

      expect(row['count']).to.equal(42);
    });

    it('should pass through boolean values directly', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'active', feature_property_type_name: 'boolean' }
      ];
      const row = featureToRow(makeFeature({ active: true }), properties);

      expect(row['active']).to.equal(true);
    });

    it('should pass through datetime values directly', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'created', feature_property_type_name: 'datetime' }
      ];
      const row = featureToRow(makeFeature({ created: '2024-01-01T00:00:00Z' }), properties);

      expect(row['created']).to.equal('2024-01-01T00:00:00Z');
    });

    it('should pass through code values directly (pre-resolved label)', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'status', feature_property_type_name: 'code' }
      ];
      const row = featureToRow(makeFeature({ status: 'Active' }), properties);

      expect(row['status']).to.equal('Active');
    });

    it('should pass through taxon values directly (pre-resolved name)', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'species', feature_property_type_name: 'taxon' }
      ];
      const row = featureToRow(makeFeature({ species: 'Ursus arctos' }), properties);

      expect(row['species']).to.equal('Ursus arctos');
    });

    it('should pass through artifact_key values directly', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'file', feature_property_type_name: 'artifact_key' }
      ];
      const row = featureToRow(makeFeature({ file: 'uploads/photo.jpg' }), properties);

      expect(row['file']).to.equal('uploads/photo.jpg');
    });

    it('should JSON-stringify array values', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'tags', feature_property_type_name: 'array' }
      ];
      const row = featureToRow(makeFeature({ tags: [1, 2, 3] }), properties);

      expect(row['tags']).to.equal('[1,2,3]');
    });

    it('should JSON-stringify object values', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'meta', feature_property_type_name: 'object' }
      ];
      const row = featureToRow(makeFeature({ meta: { key: 'value' } }), properties);

      expect(row['meta']).to.equal('{"key":"value"}');
    });

    it('should convert spatial property to WKB Buffer using property name as column', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'location', feature_property_type_name: 'spatial' }
      ];
      const row = featureToRow(makeFeature({ location: { type: 'Point', coordinates: [-120.0, 50.0] } }), properties);

      expect(row['location']).to.be.instanceOf(Buffer);
    });

    it('should handle multiple spatial properties independently', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' },
        { feature_property_name: 'centroid', feature_property_type_name: 'spatial' }
      ];
      const row = featureToRow(
        makeFeature({
          geometry: { type: 'Polygon', coordinates: [[[-120, 50], [-121, 50], [-121, 51], [-120, 50]]] },
          centroid: { type: 'Point', coordinates: [-120.5, 50.5] }
        }),
        properties
      );

      expect(row['geometry']).to.be.instanceOf(Buffer);
      expect(row['centroid']).to.be.instanceOf(Buffer);
      // Different geometries should produce different WKB
      expect(Buffer.compare(row['geometry'] as Buffer, row['centroid'] as Buffer)).to.not.equal(0);
    });

    it('should set null for null property values', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];
      const row = featureToRow(makeFeature({}), properties);

      expect(row['name']).to.be.null;
      expect(row['count']).to.be.null;
    });
  });

  describe('geoJsonToWkb', () => {
    it('should return null for null input', () => {
      expect(geoJsonToWkb(null)).to.be.null;
    });

    it('should return null for undefined input', () => {
      expect(geoJsonToWkb(undefined)).to.be.null;
    });

    it('should return null for non-object input', () => {
      expect(geoJsonToWkb('not geometry')).to.be.null;
    });

    it('should encode a Point as 21 bytes little-endian 2D WKB', () => {
      const wkb = geoJsonToWkb({ type: 'Point', coordinates: [-120.5, 50.25] });

      expect(wkb).to.be.instanceOf(Buffer);
      expect(wkb!.length).to.equal(21);

      // Byte order: 1 = little-endian
      expect(wkb!.readUInt8(0)).to.equal(1);
      // WKB type: 1 = Point
      expect(wkb!.readUInt32LE(1)).to.equal(1);
      // X coordinate (longitude)
      expect(wkb!.readDoubleLE(5)).to.equal(-120.5);
      // Y coordinate (latitude)
      expect(wkb!.readDoubleLE(13)).to.equal(50.25);
    });

    it('should encode a Polygon and produce a valid Buffer', () => {
      const polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-120.0, 50.0],
            [-121.0, 50.0],
            [-121.0, 51.0],
            [-120.0, 51.0],
            [-120.0, 50.0]
          ]
        ]
      };

      const wkb = geoJsonToWkb(polygon);

      expect(wkb).to.be.instanceOf(Buffer);
      // Byte order
      expect(wkb!.readUInt8(0)).to.equal(1);
      // WKB type: 3 = Polygon
      expect(wkb!.readUInt32LE(1)).to.equal(3);
      // Number of rings: 1
      expect(wkb!.readUInt32LE(5)).to.equal(1);
      // Number of points in ring: 5
      expect(wkb!.readUInt32LE(9)).to.equal(5);
      // Total size: header(5) + numRings(4) + ring(numPoints(4) + 5 * 16) = 5 + 4 + 4 + 80 = 93
      expect(wkb!.length).to.equal(93);
    });

    it('should encode a LineString', () => {
      const line = {
        type: 'LineString',
        coordinates: [
          [-120.0, 50.0],
          [-121.0, 51.0]
        ]
      };

      const wkb = geoJsonToWkb(line);

      expect(wkb).to.be.instanceOf(Buffer);
      // WKB type: 2 = LineString
      expect(wkb!.readUInt32LE(1)).to.equal(2);
      // Number of points: 2
      expect(wkb!.readUInt32LE(5)).to.equal(2);
      // header(5) + numPoints(4) + 2 * 16 = 41
      expect(wkb!.length).to.equal(41);
    });

    it('should encode a MultiPoint', () => {
      const multiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [-120.0, 50.0],
          [-121.0, 51.0]
        ]
      };

      const wkb = geoJsonToWkb(multiPoint);

      expect(wkb).to.be.instanceOf(Buffer);
      // WKB type: 4 = MultiPoint
      expect(wkb!.readUInt32LE(1)).to.equal(4);
      // Number of geometries: 2
      expect(wkb!.readUInt32LE(5)).to.equal(2);
      // header(5) + numGeometries(4) + 2 * Point(21) = 51
      expect(wkb!.length).to.equal(51);
    });

    it('should extract geometry from a Feature wrapper', () => {
      const feature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-120.0, 50.0] },
        properties: {}
      };

      const wkb = geoJsonToWkb(feature);

      expect(wkb).to.be.instanceOf(Buffer);
      expect(wkb!.length).to.equal(21);
      expect(wkb!.readUInt32LE(1)).to.equal(1); // Point
    });

    it('should extract first geometry from a FeatureCollection', () => {
      const featureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-120.0, 50.0] },
            properties: {}
          }
        ]
      };

      const wkb = geoJsonToWkb(featureCollection);

      expect(wkb).to.be.instanceOf(Buffer);
      expect(wkb!.length).to.equal(21);
      expect(wkb!.readUInt32LE(1)).to.equal(1); // Point
    });

    it('should return null for empty FeatureCollection', () => {
      const wkb = geoJsonToWkb({ type: 'FeatureCollection', features: [] });

      expect(wkb).to.be.null;
    });

    it('should encode a GeometryCollection', () => {
      const geomCollection = {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [-120.0, 50.0] },
          { type: 'Point', coordinates: [-121.0, 51.0] }
        ]
      };

      const wkb = geoJsonToWkb(geomCollection);

      expect(wkb).to.be.instanceOf(Buffer);
      // WKB type: 7 = GeometryCollection
      expect(wkb!.readUInt32LE(1)).to.equal(7);
      // Number of geometries: 2
      expect(wkb!.readUInt32LE(5)).to.equal(2);
    });
  });

  describe('extractGeoJsonGeometry', () => {
    it('should return null for null input', () => {
      expect(extractGeoJsonGeometry(null)).to.be.null;
    });

    it('should return bare geometry object directly', () => {
      const geom = { type: 'Point', coordinates: [-120.0, 50.0] };
      const result = extractGeoJsonGeometry(geom);

      expect(result).to.deep.equal(geom);
    });

    it('should unwrap Feature to its geometry', () => {
      const geom = { type: 'Point', coordinates: [-120.0, 50.0] };
      const result = extractGeoJsonGeometry({ type: 'Feature', geometry: geom, properties: {} });

      expect(result).to.deep.equal(geom);
    });

    it('should extract first geometry from FeatureCollection', () => {
      const geom = { type: 'Point', coordinates: [-120.0, 50.0] };
      const result = extractGeoJsonGeometry({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: geom, properties: {} }]
      });

      expect(result).to.deep.equal(geom);
    });

    it('should return null for unknown type', () => {
      expect(extractGeoJsonGeometry({ type: 'Unknown' })).to.be.null;
    });

    it('should handle Polygon geometry directly', () => {
      const geom = {
        type: 'Polygon',
        coordinates: [
          [
            [-120, 50],
            [-121, 50],
            [-121, 51],
            [-120, 50]
          ]
        ]
      };
      const result = extractGeoJsonGeometry(geom);

      expect(result).to.deep.equal(geom);
    });
  });

  describe('buildGeoParquetMetadata', () => {
    it('should return valid JSON', () => {
      const metadata = buildGeoParquetMetadata(['geometry']);

      expect(() => JSON.parse(metadata)).to.not.throw();
    });

    it('should have version 1.0.0', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry']));

      expect(parsed.version).to.equal('1.0.0');
    });

    it('should set primary_column to the first spatial column', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry']));

      expect(parsed.primary_column).to.equal('geometry');
    });

    it('should set primary_column to the first when multiple spatial columns exist', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry', 'centroid']));

      expect(parsed.primary_column).to.equal('geometry');
    });

    it('should specify WKB encoding for each spatial column', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry', 'centroid']));

      expect(parsed.columns.geometry.encoding).to.equal('WKB');
      expect(parsed.columns.centroid.encoding).to.equal('WKB');
    });

    it('should declare EPSG:4326 CRS for each spatial column', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry', 'centroid']));

      expect(parsed.columns.geometry.crs.id.authority).to.equal('EPSG');
      expect(parsed.columns.geometry.crs.id.code).to.equal(4326);
      expect(parsed.columns.centroid.crs.id.authority).to.equal('EPSG');
      expect(parsed.columns.centroid.crs.id.code).to.equal(4326);
    });

    it('should have empty geometry_types array for each spatial column', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry']));

      expect(parsed.columns.geometry.geometry_types).to.deep.equal([]);
    });

    it('should declare WGS 84 datum', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata(['geometry']));

      expect(parsed.columns.geometry.crs.name).to.equal('WGS 84');
      expect(parsed.columns.geometry.crs.type).to.equal('GeographicCRS');
    });
  });

  // ===========================================================================
  // WKB round-trip validation via wkx
  //
  // The byte-level tests above verify structure (header, type codes, sizes).
  // These tests verify *correctness* by decoding our WKB output with an
  // independent parser (wkx) and comparing the resulting GeoJSON coordinates.
  // ===========================================================================
  describe('geoJsonToWkb round-trip via wkx', () => {
    /**
     * Encode GeoJSON → WKB with our function, decode with wkx, return GeoJSON.
     */
    function roundTrip(geoJson: unknown): Record<string, unknown> {
      const wkb = geoJsonToWkb(geoJson);
      expect(wkb, 'WKB should not be null').to.not.be.null;
      const parsed = wkx.Geometry.parse(wkb as Buffer);
      return parsed.toGeoJSON() as Record<string, unknown>;
    }

    it('Point: coordinates survive round-trip', () => {
      const input = { type: 'Point', coordinates: [-123.3656, 48.4284] };
      const result = roundTrip(input);

      expect(result.type).to.equal('Point');
      const coords = result.coordinates as number[];
      expect(coords[0]).to.be.closeTo(-123.3656, 1e-10);
      expect(coords[1]).to.be.closeTo(48.4284, 1e-10);
    });

    it('Point: origin [0, 0]', () => {
      const result = roundTrip({ type: 'Point', coordinates: [0, 0] });
      const coords = result.coordinates as number[];

      expect(coords[0]).to.equal(0);
      expect(coords[1]).to.equal(0);
    });

    it('Point: extreme coordinates [-180, -90]', () => {
      const result = roundTrip({ type: 'Point', coordinates: [-180, -90] });
      const coords = result.coordinates as number[];

      expect(coords[0]).to.equal(-180);
      expect(coords[1]).to.equal(-90);
    });

    it('LineString: two-point line', () => {
      const input = {
        type: 'LineString',
        coordinates: [
          [-123.3656, 48.4284],
          [-123.37, 48.43]
        ]
      };
      const result = roundTrip(input);

      expect(result.type).to.equal('LineString');
      const coords = result.coordinates as number[][];
      expect(coords).to.have.lengthOf(2);
      expect(coords[0][0]).to.be.closeTo(-123.3656, 1e-10);
    });

    it('LineString: multi-segment', () => {
      const input = {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
          [2, 0],
          [3, 1]
        ]
      };
      const result = roundTrip(input);
      const coords = result.coordinates as number[][];

      expect(coords).to.have.lengthOf(4);
      expect(coords[2]).to.deep.equal([2, 0]);
    });

    it('Polygon: single ring with coordinate fidelity', () => {
      const ring = [
        [-120, 50],
        [-121, 50],
        [-121, 51],
        [-120, 51],
        [-120, 50]
      ];
      const result = roundTrip({ type: 'Polygon', coordinates: [ring] });

      expect(result.type).to.equal('Polygon');
      const rings = result.coordinates as number[][][];
      expect(rings).to.have.lengthOf(1);
      expect(rings[0]).to.have.lengthOf(5);
      // Closed ring: first == last
      expect(rings[0][0]).to.deep.equal(rings[0][4]);
    });

    it('Polygon: with hole (two rings)', () => {
      const outer = [
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
        [0, 0]
      ];
      const hole = [
        [5, 5],
        [15, 5],
        [15, 15],
        [5, 15],
        [5, 5]
      ];
      const result = roundTrip({ type: 'Polygon', coordinates: [outer, hole] });
      const rings = result.coordinates as number[][][];

      expect(rings).to.have.lengthOf(2);
      expect(rings[1][0]).to.deep.equal([5, 5]);
    });

    it('MultiPoint: all points preserved', () => {
      const input = {
        type: 'MultiPoint',
        coordinates: [
          [-123.0, 48.0],
          [-124.0, 49.0],
          [-125.0, 50.0]
        ]
      };
      const result = roundTrip(input);

      expect(result.type).to.equal('MultiPoint');
      const coords = result.coordinates as number[][];
      expect(coords).to.have.lengthOf(3);
      expect(coords[1][0]).to.equal(-124);
    });

    it('MultiLineString: two lines', () => {
      const input = {
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [1, 1]
          ],
          [
            [2, 2],
            [3, 3]
          ]
        ]
      };
      const result = roundTrip(input);

      expect(result.type).to.equal('MultiLineString');
      const lines = result.coordinates as number[][][];
      expect(lines).to.have.lengthOf(2);
      expect(lines[1][0]).to.deep.equal([2, 2]);
    });

    it('MultiPolygon: two polygons', () => {
      const poly1 = [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0]
        ]
      ];
      const poly2 = [
        [
          [10, 10],
          [11, 10],
          [11, 11],
          [10, 11],
          [10, 10]
        ]
      ];
      const result = roundTrip({ type: 'MultiPolygon', coordinates: [poly1, poly2] });

      expect(result.type).to.equal('MultiPolygon');
      const polys = result.coordinates as number[][][][];
      expect(polys).to.have.lengthOf(2);
      expect(polys[1][0][0]).to.deep.equal([10, 10]);
    });

    it('GeometryCollection: mixed types', () => {
      const input = {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [1, 2] },
          {
            type: 'LineString',
            coordinates: [
              [3, 4],
              [5, 6]
            ]
          }
        ]
      };
      const result = roundTrip(input);

      expect(result.type).to.equal('GeometryCollection');
      const geoms = result.geometries as Record<string, unknown>[];
      expect(geoms).to.have.lengthOf(2);
      expect(geoms[0].type).to.equal('Point');
      expect(geoms[1].type).to.equal('LineString');
    });

    it('GeometryCollection: empty', () => {
      const result = roundTrip({ type: 'GeometryCollection', geometries: [] });

      expect(result.type).to.equal('GeometryCollection');
      expect(result.geometries).to.have.lengthOf(0);
    });

    it('Feature wrapper: unwraps and encodes geometry', () => {
      const result = roundTrip({
        type: 'Feature',
        properties: { name: 'test' },
        geometry: { type: 'Point', coordinates: [7, 8] }
      });

      expect(result.type).to.equal('Point');
      expect(result.coordinates).to.deep.equal([7, 8]);
    });

    it('FeatureCollection wrapper: uses first geometry', () => {
      const result = roundTrip({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [5, 10] } },
          { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [15, 20] } }
        ]
      });

      expect(result.type).to.equal('Point');
      expect(result.coordinates).to.deep.equal([5, 10]);
    });
  });
});

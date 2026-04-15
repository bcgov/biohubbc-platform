import { expect } from 'chai';
import { describe, it } from 'mocha';

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

    it('should return undefined for spatial (handled as geometry column)', () => {
      expect(propertyTypeToParquetType('spatial')).to.be.undefined;
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
      const schema = buildParquetSchema([], false);

      expect(schema.fields['uuid']).to.exist;
    });

    it('should always include parent_uuid as nullable column', () => {
      const schema = buildParquetSchema([], false);

      expect(schema.fields['parent_uuid']).to.exist;
    });

    it('should add geometry column when hasSpatial is true', () => {
      const schema = buildParquetSchema([], true);

      expect(schema.fields['geometry']).to.exist;
    });

    it('should not add geometry column when hasSpatial is false', () => {
      const schema = buildParquetSchema([], false);

      expect(schema.fields['geometry']).to.not.exist;
    });

    it('should skip spatial properties from the property list', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'location', feature_property_type_name: 'spatial' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];
      const schema = buildParquetSchema(properties, true);

      expect(schema.fields['name']).to.exist;
      expect(schema.fields['count']).to.exist;
      // Spatial property is not a column — it goes to the geometry column
      expect(schema.fields['location']).to.not.exist;
      // But geometry column is present because hasSpatial is true
      expect(schema.fields['geometry']).to.exist;
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
      const schema = buildParquetSchema(properties, false);

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

    it('should convert spatial property to WKB Buffer in geometry column', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'location', feature_property_type_name: 'spatial' }
      ];
      const row = featureToRow(
        makeFeature({ location: { type: 'Point', coordinates: [-120.0, 50.0] } }),
        properties
      );

      expect(row['geometry']).to.be.instanceOf(Buffer);
      // Spatial property name is not a column — data goes to geometry column
      expect(row).to.not.have.property('location');
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
      const metadata = buildGeoParquetMetadata();

      expect(() => JSON.parse(metadata)).to.not.throw();
    });

    it('should have version 1.0.0', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata());

      expect(parsed.version).to.equal('1.0.0');
    });

    it('should have primary_column set to geometry', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata());

      expect(parsed.primary_column).to.equal('geometry');
    });

    it('should specify WKB encoding for geometry column', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata());

      expect(parsed.columns.geometry.encoding).to.equal('WKB');
    });

    it('should declare EPSG:4326 CRS', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata());

      expect(parsed.columns.geometry.crs.id.authority).to.equal('EPSG');
      expect(parsed.columns.geometry.crs.id.code).to.equal(4326);
    });

    it('should have empty geometry_types array', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata());

      expect(parsed.columns.geometry.geometry_types).to.deep.equal([]);
    });

    it('should declare WGS 84 datum', () => {
      const parsed = JSON.parse(buildGeoParquetMetadata());

      expect(parsed.columns.geometry.crs.name).to.equal('WGS 84');
      expect(parsed.columns.geometry.crs.type).to.equal('GeographicCRS');
    });
  });
});

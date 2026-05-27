import { expect } from 'chai';
import { describe, it } from 'mocha';
import wkx from 'wkx';

import { ParquetFeatureData } from '../models/download';
import { CsvPropertyDefinition } from './csv-utils';
import {
  buildGeoParquetMetadata,
  buildParquetSchema,
  dateStringToParquet,
  expandPropertyToColumns,
  extractGeoJsonGeometry,
  featureToRow,
  geoJsonToWkb,
  propertyTypeToParquetType,
  timeStringToMillis
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

    it('should throw for datetime because the helper must be used (DATE + TIME_MILLIS expansion)', () => {
      // `datetime` cannot map to a single Parquet primitive — `expandPropertyToColumns`
      // splits it into two columns (DATE + TIME_MILLIS) before the writer asks for a
      // type. Reaching this case means a caller bypassed the helper; failing loud
      // points the bug at the caller instead of letting UTF8 silently land in the
      // Parquet footer.
      expect(() => propertyTypeToParquetType('datetime')).to.throw(/datetime/);
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

  describe('expandPropertyToColumns', () => {
    it('should return one spec for a string property', () => {
      const result = expandPropertyToColumns({
        feature_property_name: 'site_name',
        feature_property_type_name: 'string'
      });

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({ name: 'site_name', parquetType: 'UTF8' });
    });

    it('should return one spec for a number property', () => {
      const result = expandPropertyToColumns({
        feature_property_name: 'count',
        feature_property_type_name: 'number'
      });

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({ name: 'count', parquetType: 'DOUBLE' });
    });

    it('should expand a datetime property into native DATE and TIME_MILLIS specs', () => {
      const result = expandPropertyToColumns({
        feature_property_name: 'observed_at',
        feature_property_type_name: 'datetime'
      });

      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ name: 'observed_at_date', parquetType: 'DATE' });
      expect(result[1]).to.deep.equal({ name: 'observed_at_time', parquetType: 'TIME_MILLIS' });
    });

    it('should preserve property name for spatial', () => {
      const result = expandPropertyToColumns({
        feature_property_name: 'geometry',
        feature_property_type_name: 'spatial'
      });

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({ name: 'geometry', parquetType: 'BYTE_ARRAY' });
    });

    it('should return a UTF8 column flagged as repeated for a feature property (native Parquet LIST)', () => {
      const result = expandPropertyToColumns({
        feature_property_name: 'child_features',
        feature_property_type_name: 'feature'
      });

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({ name: 'child_features', parquetType: 'UTF8', repeated: true });
    });
  });

  describe('dateStringToParquet', () => {
    it('should convert YYYY-MM-DD to a Date at UTC midnight', () => {
      const d = dateStringToParquet('2024-06-15');
      expect(d).to.be.instanceOf(Date);
      expect(d.toISOString()).to.equal('2024-06-15T00:00:00.000Z');
    });
  });

  describe('timeStringToMillis', () => {
    it('should convert HH:MM:SS to milliseconds-since-midnight', () => {
      // 13:45:00 → (13*3600 + 45*60 + 0) * 1000 = 49_500_000.
      expect(timeStringToMillis('13:45:00')).to.equal(49_500_000);
    });

    it('should produce 0 for midnight', () => {
      expect(timeStringToMillis('00:00:00')).to.equal(0);
    });

    it('should produce a value within INT32 range for the last second of the day', () => {
      // 23:59:59 → 86_399_000; INT32 ceiling is ~2.14e9 so we have plenty of headroom.
      expect(timeStringToMillis('23:59:59')).to.equal(86_399_000);
    });

    it('should clamp Postgres end-of-day 24:00:00 to 86_399_999', () => {
      // Postgres `time` accepts '24:00:00' as ISO 8601 nominal end-of-day, but
      // Parquet TIME_MILLIS doesn't define 86_400_000 and downstream readers
      // disagree on how to handle it. The clamp keeps the cell in the de facto
      // 0..86_399_999 range at a 1 ms cost, preferable to wrapping to 00:00:00.
      expect(timeStringToMillis('24:00:00')).to.equal(86_399_999);
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
      // datetime expands into two native columns (DATE + TIME_MILLIS); the bare `created` field is gone.
      expect(schema.fields['created']).to.not.exist;
      expect(schema.fields['created_date']).to.exist;
      expect(schema.fields['created_time']).to.exist;
      expect(schema.fields['status']).to.exist;
      expect(schema.fields['species']).to.exist;
      expect(schema.fields['tags']).to.exist;
      expect(schema.fields['meta']).to.exist;
      expect(schema.fields['file']).to.exist;
    });

    it('should expand a datetime property into native DATE and TIME_MILLIS columns', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'observed_at', feature_property_type_name: 'datetime' }
      ];
      const schema = buildParquetSchema(properties);

      expect(schema.fields['observed_at']).to.not.exist;
      expect(schema.fields['observed_at_date']).to.exist;
      expect(schema.fields['observed_at_time']).to.exist;
      // DATE → INT32 days-since-epoch; TIME_MILLIS → INT32 ms-since-midnight.
      expect(schema.fields['observed_at_date'].primitiveType).to.equal('INT32');
      expect(schema.fields['observed_at_date'].originalType).to.equal('DATE');
      expect(schema.fields['observed_at_time'].primitiveType).to.equal('INT32');
      expect(schema.fields['observed_at_time'].originalType).to.equal('TIME_MILLIS');
    });

    it('should always include submission_feature_id as a NOT NULL INT64 column', () => {
      const schema = buildParquetSchema([]);

      const sfid = schema.fields['submission_feature_id'];
      expect(sfid).to.exist;
      expect(sfid.primitiveType).to.equal('INT64');
      // optional=false in @dsnp/parquetjs surfaces as REQUIRED on the schema field.
      expect(sfid.repetitionType).to.equal('REQUIRED');
    });

    it('should mark a feature-typed column as REPEATED in the Parquet schema (native LIST)', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'child_features', feature_property_type_name: 'feature' }
      ];
      const schema = buildParquetSchema(properties);

      const field = schema.fields['child_features'];
      expect(field).to.exist;
      // `repeated: true` in @dsnp/parquetjs surfaces as REPEATED on the schema field.
      expect(field.repetitionType).to.equal('REPEATED');
      // UTF8 elements — downstream readers UNNEST into a string column.
      expect(field.originalType).to.equal('UTF8');
    });

    it('should throw when a datetime expansion collides with a sibling property name', () => {
      // Schema-build is the gate for collision detection; downstream consumers
      // (hydrator, writer) trust the validated list.
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'observation', feature_property_type_name: 'datetime' },
        { feature_property_name: 'observation_date', feature_property_type_name: 'string' }
      ];

      expect(() => buildParquetSchema(properties)).to.throw(/observation_date/);
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

    it('should include submission_feature_id in every row', () => {
      const feature = makeFeature({});
      const row = featureToRow(feature, []);

      expect(row['submission_feature_id']).to.equal(1);
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

    it('should convert the two datetime cells to native primitives for the Parquet writer', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'created', feature_property_type_name: 'datetime' }
      ];
      const row = featureToRow(makeFeature({ created_date: '2024-06-15', created_time: '13:45:00' }), properties);

      // DATE column: a Date instance at UTC midnight (the writer encodes
      // `getTime() / 86_400_000` to days-since-epoch INT32).
      expect(row['created_date']).to.be.instanceOf(Date);
      expect((row['created_date'] as Date).toISOString()).to.equal('2024-06-15T00:00:00.000Z');
      // TIME_MILLIS column: ms-since-midnight INT32.
      // 13:45:00 → (13*3600 + 45*60) * 1000 = 49_500_000.
      expect(row['created_time']).to.equal(49_500_000);
      // The bare property name must not appear — Parquet schema expects only the suffixed pair.
      expect(row).to.not.have.property('created');
    });

    it('should write null for the missing component of a date-only datetime', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'created', feature_property_type_name: 'datetime' }
      ];
      const row = featureToRow(makeFeature({ created_date: '2024-06-15' }), properties);

      expect(row['created_date']).to.be.instanceOf(Date);
      expect((row['created_date'] as Date).toISOString()).to.equal('2024-06-15T00:00:00.000Z');
      expect(row['created_time']).to.be.null;
    });

    it('should write null for the missing component of a time-only datetime', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'created', feature_property_type_name: 'datetime' }
      ];
      const row = featureToRow(makeFeature({ created_time: '13:45:00' }), properties);

      expect(row['created_date']).to.be.null;
      expect(row['created_time']).to.equal(49_500_000);
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
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-120, 50],
                [-121, 50],
                [-121, 51],
                [-120, 50]
              ]
            ]
          },
          centroid: { type: 'Point', coordinates: [-120.5, 50.5] }
        }),
        properties
      );

      expect(row['geometry']).to.be.instanceOf(Buffer);
      expect(row['centroid']).to.be.instanceOf(Buffer);
      // Different geometries should produce different WKB
      expect(Buffer.compare(row['geometry'] as Buffer, row['centroid'] as Buffer)).to.not.equal(0);
    });

    it('should pass through a single-element feature array unchanged for the Parquet LIST writer', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'child_features', feature_property_type_name: 'feature' }
      ];
      const row = featureToRow(makeFeature({ child_features: ['urn:1'] }), properties);

      expect(row['child_features']).to.deep.equal(['urn:1']);
    });

    it('should preserve order in a multi-element feature array', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'child_features', feature_property_type_name: 'feature' }
      ];
      const row = featureToRow(makeFeature({ child_features: ['urn:1', 'urn:2'] }), properties);

      expect(row['child_features']).to.deep.equal(['urn:1', 'urn:2']);
    });

    it('should pass through an empty feature array as [] (not null) so the LIST writer emits an empty list', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'child_features', feature_property_type_name: 'feature' }
      ];
      const row = featureToRow(makeFeature({ child_features: [] }), properties);

      expect(row['child_features']).to.deep.equal([]);
    });

    it('should defensively wrap a non-array feature scalar in a single-element array', () => {
      // Contract drift defense: the hydrator guarantees arrays of URN strings,
      // but a malformed cell from upstream should land in Parquet as a valid
      // one-element list rather than crash the LIST writer mid-file.
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'child_features', feature_property_type_name: 'feature' }
      ];
      const row = featureToRow(makeFeature({ child_features: 'urn:x' }), properties);

      expect(row['child_features']).to.deep.equal(['urn:x']);
    });

    it('should set null for a missing feature property key (the shared null guard runs before encoding)', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'child_features', feature_property_type_name: 'feature' }
      ];
      const row = featureToRow(makeFeature({}), properties);

      expect(row['child_features']).to.be.null;
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

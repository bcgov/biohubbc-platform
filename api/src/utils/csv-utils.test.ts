import { expect } from 'chai';
import { describe, it } from 'mocha';
import wkx from 'wkx';
import {
  buildCombinedHeaders,
  buildSchemaHeaders,
  CsvPropertyDefinition,
  escapeCsvField,
  flattenArray,
  flattenFeatureBySchema,
  flattenFeatureWithParent,
  flattenObject,
  generateCsv,
  getOutputFilename,
  groupFeaturesByType
} from './csv-utils';

/**
 * Helper: GeoJSON → WKB Buffer via wkx, mirroring how the Parquet writer
 * encodes spatial values. Lets WKT-mode tests start from readable GeoJSON.
 */
function geoJsonToWkbBuffer(geoJson: unknown): Buffer {
  return wkx.Geometry.parseGeoJSON(geoJson as object).toWkb();
}

describe('csv-utils', () => {
  describe('flattenObject', () => {
    it('should flatten a simple object', () => {
      const result = flattenObject({ a: 1, b: 'hello' });

      expect(result).to.deep.equal({ a: '1', b: 'hello' });
    });

    it('should flatten nested objects with underscore separator', () => {
      const result = flattenObject({ a: { b: { c: 'deep' } } });

      expect(result).to.deep.equal({ a_b_c: 'deep' });
    });

    it('should convert arrays to semicolon-separated strings', () => {
      const result = flattenObject({ ids: [1, 2, 3] });

      expect(result).to.deep.equal({ ids: '1;2;3' });
    });

    it('should handle null and undefined as empty strings', () => {
      const result = flattenObject({ a: null, b: undefined });

      expect(result).to.deep.equal({ a: '', b: '' });
    });

    it('should handle arrays of objects with single property', () => {
      const result = flattenObject({
        focal_species: [{ taxon_id: 180703 }, { taxon_id: 12345 }]
      });

      expect(result).to.deep.equal({ focal_species: '180703;12345' });
    });
  });

  describe('flattenArray', () => {
    it('should join primitive values with semicolons', () => {
      const result = flattenArray([1, 2, 3]);

      expect(result).to.equal('1;2;3');
    });

    it('should extract single property from objects', () => {
      const result = flattenArray([{ taxon_id: 100 }, { taxon_id: 200 }]);

      expect(result).to.equal('100;200');
    });

    it('should join multiple properties with colon', () => {
      const result = flattenArray([
        { a: 1, b: 2 },
        { a: 3, b: 4 }
      ]);

      expect(result).to.equal('1:2;3:4');
    });

    it('should handle null and undefined in arrays', () => {
      const result = flattenArray([1, null, 3, undefined]);

      expect(result).to.equal('1;;3;');
    });

    it('should preserve special characters in values', () => {
      const result = flattenArray(['hello, world', 'say "hi"', 'line\nnew']);

      expect(result).to.equal('hello, world;say "hi";line\nnew');
    });
  });

  describe('escapeCsvField', () => {
    it('should return unchanged for simple values', () => {
      expect(escapeCsvField('hello')).to.equal('hello');
    });

    it('should wrap values with commas in quotes', () => {
      expect(escapeCsvField('hello, world')).to.equal('"hello, world"');
    });

    it('should escape quotes by doubling them', () => {
      expect(escapeCsvField('say "hello"')).to.equal('"say ""hello"""');
    });

    it('should wrap values with newlines in quotes', () => {
      expect(escapeCsvField('line1\nline2')).to.equal('"line1\nline2"');
    });

    it('should wrap values with carriage returns in quotes', () => {
      expect(escapeCsvField('line1\r\nline2')).to.equal('"line1\r\nline2"');
      expect(escapeCsvField('line1\rline2')).to.equal('"line1\rline2"');
    });

    it('should handle combined commas and quotes', () => {
      expect(escapeCsvField('value "A", value "B"')).to.equal('"value ""A"", value ""B"""');
    });

    it('should handle combined newlines and commas', () => {
      expect(escapeCsvField('line1, continued\nline2')).to.equal('"line1, continued\nline2"');
    });

    it('should pass through unicode characters without quoting', () => {
      expect(escapeCsvField('Grizzly résumé')).to.equal('Grizzly résumé');
      expect(escapeCsvField('北极熊')).to.equal('北极熊');
      expect(escapeCsvField('élévation')).to.equal('élévation');
    });

    it('should quote unicode values that also contain delimiters', () => {
      expect(escapeCsvField('ours, résumé')).to.equal('"ours, résumé"');
    });

    it('should return empty string unchanged', () => {
      expect(escapeCsvField('')).to.equal('');
    });
  });

  describe('generateCsv', () => {
    it('should generate CSV with header row', () => {
      const records = [
        { name: 'Test', count: '5', taxon_id: '180703' },
        { name: 'Other', count: '10', taxon_id: '12345' }
      ];

      const result = generateCsv(records);
      const lines = result.split('\n');

      expect(lines[0]).to.equal('count,name,taxon_id');
      expect(lines[1]).to.equal('5,Test,180703');
      expect(lines[2]).to.equal('10,Other,12345');
    });

    it('should return empty string for empty array', () => {
      const result = generateCsv([]);

      expect(result).to.equal('');
    });

    it('should handle missing values in some records', () => {
      const records: Record<string, string>[] = [
        { name: '1', count: '1', taxon_id: '2' },
        { name: '2', count: '3' } // missing 'taxon_id'
      ];

      const result = generateCsv(records);
      const lines = result.split('\n');

      expect(lines[0]).to.equal('count,name,taxon_id');
      expect(lines[1]).to.equal('1,1,2');
      expect(lines[2]).to.equal('3,2,'); // empty value for missing 'taxon_id'
    });

    it('should sort headers alphabetically', () => {
      const records = [{ z: '1', name: '2', a: '3' }];

      const result = generateCsv(records);
      const lines = result.split('\n');

      expect(lines[0]).to.equal('a,name,z');
    });

    it('should escape special characters in data values', () => {
      const records = [
        { description: 'Rocky streambed, gravel substrate', name: 'Site "Alpha"' },
        { description: 'Line 1\nLine 2', name: 'Normal' }
      ];

      const result = generateCsv(records);
      const lines = result.split('\n');

      expect(lines[0]).to.equal('description,name');
      expect(lines[1]).to.equal('"Rocky streambed, gravel substrate","Site ""Alpha"""');
      // Newline in value means the raw CSV has 4 lines (header + row1 + row2-part1 + row2-part2)
      // but the logical row is: "Line 1\nLine 2",Normal
      expect(result).to.include('"Line 1\nLine 2",Normal');
    });
  });

  describe('groupFeaturesByType', () => {
    it('should group features by feature_type_name', () => {
      const features = [
        { feature_type_name: 'dataset', id: 1 },
        { feature_type_name: 'observation', id: 2 },
        { feature_type_name: 'dataset', id: 3 },
        { feature_type_name: 'observation', id: 4 }
      ];

      const result = groupFeaturesByType(features);

      expect(result.get('dataset')).to.have.length(2);
      expect(result.get('observation')).to.have.length(2);
      expect(result.get('dataset')![0].id).to.equal(1);
      expect(result.get('dataset')![1].id).to.equal(3);
    });
  });

  describe('getOutputFilename', () => {
    it('should return multimedia.csv for file type', () => {
      expect(getOutputFilename('file')).to.equal('multimedia.csv');
    });

    it('should return feature_type.csv for other types', () => {
      expect(getOutputFilename('dataset')).to.equal('dataset.csv');
      expect(getOutputFilename('species_observation')).to.equal('species_observation.csv');
    });
  });

  describe('buildSchemaHeaders', () => {
    it('should return property names as headers', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];

      expect(buildSchemaHeaders(properties)).to.deep.equal(['name', 'count']);
    });

    it('should emit a single column under the property name for spatial properties', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];

      expect(buildSchemaHeaders(properties)).to.deep.equal(['geometry']);
    });

    it('should map artifact_key type to filePath header', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'artifact_key', feature_property_type_name: 'artifact_key' }
      ];

      expect(buildSchemaHeaders(properties)).to.deep.equal(['filePath']);
    });

    it('should return empty array for empty input', () => {
      expect(buildSchemaHeaders([])).to.deep.equal([]);
    });

    it('should preserve property name and order across mixed spatial and non-spatial columns', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'description', feature_property_type_name: 'string' },
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' },
        { feature_property_name: 'centroid', feature_property_type_name: 'spatial' },
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];

      expect(buildSchemaHeaders(properties)).to.deep.equal(['description', 'geometry', 'centroid', 'name']);
    });
  });

  describe('buildCombinedHeaders', () => {
    it('should combine system, parent, and child headers in order', () => {
      const parentProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'device_key', feature_property_type_name: 'string' },
        { feature_property_name: 'animal_identifier', feature_property_type_name: 'string' }
      ];
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' },
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];

      const result = buildCombinedHeaders(parentProperties, childProperties, ['dataset_name', 'dataset_id']);

      expect(result).to.deep.equal([
        'dataset_name',
        'dataset_id',
        'device_key',
        'animal_identifier',
        'timestamp',
        'geometry'
      ]);
    });

    it('should work without parent properties', () => {
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];

      const result = buildCombinedHeaders(null, childProperties, ['dataset_name']);

      expect(result).to.deep.equal(['dataset_name', 'name']);
    });

    it('should work without system headers', () => {
      const parentProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'device_key', feature_property_type_name: 'string' }
      ];
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' }
      ];

      const result = buildCombinedHeaders(parentProperties, childProperties);

      expect(result).to.deep.equal(['device_key', 'timestamp']);
    });

    it('should return only child headers when no parent and no system headers', () => {
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'value', feature_property_type_name: 'number' }
      ];

      const result = buildCombinedHeaders(null, childProperties);

      expect(result).to.deep.equal(['value']);
    });
  });

  describe('flattenFeatureWithParent', () => {
    it('should merge parent and child data', () => {
      const parentProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'device_key', feature_property_type_name: 'string' },
        { feature_property_name: 'animal_identifier', feature_property_type_name: 'string' }
      ];
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' },
        { feature_property_name: 'temperature', feature_property_type_name: 'number' }
      ];
      const parentData = { device_key: 'TAG-001', animal_identifier: 'M12345' };
      const childData = { timestamp: '2024-01-01T12:00:00Z', temperature: 22.5 };

      const result = flattenFeatureWithParent(childData, childProperties, parentData, parentProperties, 100);

      expect(result).to.deep.equal({
        device_key: 'TAG-001',
        animal_identifier: 'M12345',
        timestamp: '2024-01-01T12:00:00Z',
        temperature: '22.5'
      });
    });

    it('should work without parent data', () => {
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];
      const childData = { name: 'Test Dataset' };

      const result = flattenFeatureWithParent(childData, childProperties, null, null, 100);

      expect(result).to.deep.equal({ name: 'Test Dataset' });
    });

    it('should let child values overwrite parent values on collision', () => {
      const parentProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];
      const parentData = { name: 'Parent Name' };
      const childData = { name: 'Child Name' };

      const result = flattenFeatureWithParent(childData, childProperties, parentData, parentProperties, 100);

      expect(result).to.deep.equal({ name: 'Child Name' });
    });

    it('should handle spatial properties in parent and child as named WKT columns', () => {
      const parentProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'deployment_location', feature_property_type_name: 'spatial' }
      ];
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];
      const parentData = {
        deployment_location: geoJsonToWkbBuffer({ type: 'Point', coordinates: [-120.0, 50.0] })
      };
      const childData = {
        geometry: geoJsonToWkbBuffer({ type: 'Point', coordinates: [-121.5, 51.5] })
      };

      const result = flattenFeatureWithParent(childData, childProperties, parentData, parentProperties, 100);

      // Each spatial property keeps its own column — no collision between parent and child.
      expect(result.deployment_location).to.match(/^POINT\(/);
      expect(result.geometry).to.match(/^POINT\(/);
    });
  });

  describe('flattenFeatureBySchema', () => {
    it('should pass through string, number, datetime, boolean values', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'count', feature_property_type_name: 'number' },
        { feature_property_name: 'timestamp', feature_property_type_name: 'datetime' },
        { feature_property_name: 'active', feature_property_type_name: 'boolean' }
      ];
      const data = { name: 'Bear', count: 5, timestamp: '2024-01-01T00:00:00Z', active: true };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({
        name: 'Bear',
        count: '5',
        timestamp: '2024-01-01T00:00:00Z',
        active: 'true'
      });
    });

    it('should flatten arrays with semicolons', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'focal_species', feature_property_type_name: 'array' }
      ];
      const data = { focal_species: [{ taxon_id: 180703 }, { taxon_id: 12345 }] };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({ focal_species: '180703;12345' });
    });

    it('should generate zip-relative path for artifact_key mapped to filePath column', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'artifact_key', feature_property_type_name: 'artifact_key' }
      ];
      const data = { artifact_key: 'uploads/photo.jpg' };

      const result = flattenFeatureBySchema(data, properties, 42);

      expect(result).to.deep.equal({ filePath: 'files/42_photo.jpg' });
    });

    it('should fall back to data.file for artifact_key value', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'artifact_key', feature_property_type_name: 'artifact_key' }
      ];
      const data = { file: 'uploads/photo.jpg' };

      const result = flattenFeatureBySchema(data, properties, 42);

      expect(result).to.deep.equal({ filePath: 'files/42_photo.jpg' });
    });

    it('should stringify objects', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'metadata', feature_property_type_name: 'object' }
      ];
      const data = { metadata: { key: 'value' } };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({ metadata: '{"key":"value"}' });
    });

    it('should return empty strings for null/undefined values', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'count', feature_property_type_name: 'number' }
      ];

      const result = flattenFeatureBySchema({}, properties, 100);

      expect(result).to.deep.equal({ name: '', count: '' });
    });

    it('should preserve special characters in string values for downstream escaping', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'description', feature_property_type_name: 'string' },
        { feature_property_name: 'name', feature_property_type_name: 'string' },
        { feature_property_name: 'comment', feature_property_type_name: 'string' }
      ];
      const data = {
        description: 'Rocky streambed, with gravel substrate',
        name: 'Site "Alpha"',
        comment: 'Line 1\nLine 2'
      };

      const result = flattenFeatureBySchema(data, properties, 100);

      // flattenFeatureBySchema preserves raw strings; escapeCsvField handles quoting later
      expect(result.description).to.equal('Rocky streambed, with gravel substrate');
      expect(result.name).to.equal('Site "Alpha"');
      expect(result.comment).to.equal('Line 1\nLine 2');
    });

    it('should preserve unicode characters in string values', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];

      const result = flattenFeatureBySchema({ name: 'Réseau élévation 北极' }, properties, 100);

      expect(result.name).to.equal('Réseau élévation 北极');
    });
  });

  describe('flattenFeatureBySchema spatial (WKB → WKT)', () => {
    const spatialProps: CsvPropertyDefinition[] = [
      { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
    ];

    /**
     * Round-trip: encode the GeoJSON to WKB (the way the Parquet writer does),
     * pass through flattenFeatureBySchema, parse the WKT back via wkx, and
     * return the decoded GeoJSON for shape assertions.
     */
    function roundTripWkt(geoJson: object): Record<string, unknown> {
      const wkb = geoJsonToWkbBuffer(geoJson);
      const result = flattenFeatureBySchema({ geometry: wkb }, spatialProps, 100);
      const wkt = result.geometry;
      expect(wkt).to.be.a('string').and.not.equal('');
      return wkx.Geometry.parse(wkt as string).toGeoJSON() as Record<string, unknown>;
    }

    it('round-trips a Point', () => {
      const decoded = roundTripWkt({ type: 'Point', coordinates: [-123.3656, 48.4284] });

      expect(decoded.type).to.equal('Point');
      const coords = decoded.coordinates as number[];
      expect(coords[0]).to.be.closeTo(-123.3656, 1e-10);
      expect(coords[1]).to.be.closeTo(48.4284, 1e-10);
    });

    it('round-trips a LineString', () => {
      const decoded = roundTripWkt({
        type: 'LineString',
        coordinates: [
          [-120, 50],
          [-121, 51],
          [-122, 52]
        ]
      });

      expect(decoded.type).to.equal('LineString');
      expect((decoded.coordinates as number[][]).length).to.equal(3);
    });

    it('round-trips a Polygon', () => {
      const decoded = roundTripWkt({
        type: 'Polygon',
        coordinates: [
          [
            [-120, 50],
            [-121, 50],
            [-121, 51],
            [-120, 51],
            [-120, 50]
          ]
        ]
      });

      expect(decoded.type).to.equal('Polygon');
      expect((decoded.coordinates as number[][][])[0].length).to.equal(5);
    });

    it('round-trips a MultiPoint', () => {
      const decoded = roundTripWkt({
        type: 'MultiPoint',
        coordinates: [
          [-120, 50],
          [-121, 51]
        ]
      });

      expect(decoded.type).to.equal('MultiPoint');
      expect((decoded.coordinates as number[][]).length).to.equal(2);
    });

    it('round-trips a MultiLineString', () => {
      const decoded = roundTripWkt({
        type: 'MultiLineString',
        coordinates: [
          [
            [-120, 50],
            [-121, 51]
          ],
          [
            [-122, 52],
            [-123, 53]
          ]
        ]
      });

      expect(decoded.type).to.equal('MultiLineString');
      expect((decoded.coordinates as number[][][]).length).to.equal(2);
    });

    it('round-trips a MultiPolygon', () => {
      const decoded = roundTripWkt({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-120, 50],
              [-121, 50],
              [-121, 51],
              [-120, 51],
              [-120, 50]
            ]
          ],
          [
            [
              [-130, 60],
              [-131, 60],
              [-131, 61],
              [-130, 61],
              [-130, 60]
            ]
          ]
        ]
      });

      expect(decoded.type).to.equal('MultiPolygon');
      expect((decoded.coordinates as number[][][][]).length).to.equal(2);
    });

    it('emits empty string for null spatial value', () => {
      const result = flattenFeatureBySchema({ geometry: null }, spatialProps, 100);

      expect(result).to.deep.equal({ geometry: '' });
    });

    it('emits empty string for non-Buffer spatial value', () => {
      // Whatever the source — GeoJSON object, string, undefined — only Buffer
      // values flow through. Anything else is empty-celled.
      const result = flattenFeatureBySchema(
        { geometry: { type: 'Point', coordinates: [-120, 50] } },
        spatialProps,
        100
      );

      expect(result).to.deep.equal({ geometry: '' });
    });

    it('emits empty string for malformed WKB buffer', () => {
      const result = flattenFeatureBySchema({ geometry: Buffer.from([0xff, 0xff, 0xff, 0xff]) }, spatialProps, 100);

      expect(result).to.deep.equal({ geometry: '' });
    });
  });
});

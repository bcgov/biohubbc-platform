import { expect } from 'chai';
import { describe, it } from 'mocha';
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

    it('should expand spatial to decimalLatitude and decimalLongitude', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];

      expect(buildSchemaHeaders(properties)).to.deep.equal(['decimalLatitude', 'decimalLongitude']);
    });

    it('should return empty array for empty input', () => {
      expect(buildSchemaHeaders([])).to.deep.equal([]);
    });

    it('should preserve schema order', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'description', feature_property_type_name: 'string' },
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' },
        { feature_property_name: 'name', feature_property_type_name: 'string' }
      ];

      expect(buildSchemaHeaders(properties)).to.deep.equal([
        'description',
        'decimalLatitude',
        'decimalLongitude',
        'name'
      ]);
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
        'decimalLatitude',
        'decimalLongitude'
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

    it('should handle spatial properties in both parent and child', () => {
      const parentProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'deployment_location', feature_property_type_name: 'spatial' }
      ];
      const childProperties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];
      const parentData = {
        deployment_location: { type: 'Point', coordinates: [-120.0, 50.0] }
      };
      const childData = {
        geometry: { type: 'Point', coordinates: [-121.5, 51.5] }
      };

      const result = flattenFeatureWithParent(childData, childProperties, parentData, parentProperties, 100);

      // Child spatial overwrites parent spatial (both write to decimalLatitude/decimalLongitude)
      expect(result).to.deep.equal({
        decimalLatitude: '51.5',
        decimalLongitude: '-121.5'
      });
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

    it('should extract coordinates from a FeatureCollection', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];
      const data = {
        geometry: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-124.856, 54.321] } }]
        }
      };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({ decimalLatitude: '54.321', decimalLongitude: '-124.856' });
    });

    it('should extract coordinates from a bare Point', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];
      const data = { geometry: { type: 'Point', coordinates: [-130.5, 56.2] } };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({ decimalLatitude: '56.2', decimalLongitude: '-130.5' });
    });

    it('should return empty strings for null spatial value', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];

      const result = flattenFeatureBySchema({ geometry: null }, properties, 100);

      expect(result).to.deep.equal({ decimalLatitude: '', decimalLongitude: '' });
    });

    it('should return empty strings when no Point found in spatial', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'geometry', feature_property_type_name: 'spatial' }
      ];
      const data = {
        geometry: { type: 'FeatureCollection', features: [] }
      };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({ decimalLatitude: '', decimalLongitude: '' });
    });

    it('should flatten arrays with semicolons', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'focal_species', feature_property_type_name: 'array' }
      ];
      const data = { focal_species: [{ taxon_id: 180703 }, { taxon_id: 12345 }] };

      const result = flattenFeatureBySchema(data, properties, 100);

      expect(result).to.deep.equal({ focal_species: '180703;12345' });
    });

    it('should generate zip-relative path for artifact_key', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'artifact_key', feature_property_type_name: 'artifact_key' }
      ];
      const data = { artifact_key: 'uploads/photo.jpg' };

      const result = flattenFeatureBySchema(data, properties, 42);

      expect(result).to.deep.equal({ artifact_key: 'files/42_photo.jpg' });
    });

    it('should fall back to data.file for artifact_key value', () => {
      const properties: CsvPropertyDefinition[] = [
        { feature_property_name: 'artifact_key', feature_property_type_name: 'artifact_key' }
      ];
      const data = { file: 'uploads/photo.jpg' };

      const result = flattenFeatureBySchema(data, properties, 42);

      expect(result).to.deep.equal({ artifact_key: 'files/42_photo.jpg' });
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
  });
});

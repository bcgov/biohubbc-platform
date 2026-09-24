import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { FeatureType, FeatureTypeWithProperties, FeatureTypeWithPropertyDefinitions } from '../models/feature-type';
import { CodeRepository } from './code-repository';

chai.use(sinonChai);

describe('CodeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getFeatureTypes', () => {
    it('should return rows if succeeds', async () => {
      const mockRow: FeatureType = {
        feature_type_id: 1,
        name: 'survey',
        display_name: 'Survey',
        description: null
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const codeRepository = new CodeRepository(mockDBConnection);

      const result = await codeRepository.getFeatureTypes();

      expect(result).to.be.eql([mockRow]);
    });
  });

  describe('getFeatureTypePropertiesByBlueprintId', () => {
    it('returns the rows for the given Blueprint', async () => {
      const mockRow: FeatureTypeWithProperties = {
        feature_type: {
          feature_type_id: 1,
          name: 'survey',
          display_name: 'Survey',
          description: null
        },
        properties: [
          {
            blueprint_feature_type_property_id: 2,
            feature_property_id: 31,
            name: 'name',
            display_name: 'Name',
            description: 'Name',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            required_value: true,
            calculated_value: false,
            allow_multiple: false
          }
        ]
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const codeRepository = new CodeRepository(mockDBConnection);

      const result = await codeRepository.getFeatureTypePropertiesByBlueprintId(7);

      expect(result).to.be.eql([mockRow]);
      const statement = sqlStub.firstCall.args[0];
      expect(statement.text).to.include('bft.blueprint_id = $1');
      expect(statement.values).to.eql([7]);
      expect(statement.text).to.not.include('is_default');
    });
  });

  describe('getFeatureTypeProperties', () => {
    it('reads assignments from every Blueprint at every lifecycle', async () => {
      const mockRow: FeatureTypeWithPropertyDefinitions = {
        feature_type: {
          feature_type_id: 1,
          name: 'survey',
          display_name: 'Survey',
          description: null
        },
        properties: [
          {
            feature_property_id: 31,
            name: 'name',
            display_name: 'Name',
            description: 'Name',
            type_name: FEATURE_PROPERTY_TYPE.STRING,
            calculated_value: false
          }
        ]
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const sqlStub = sinon.stub().resolves(mockQueryResponse);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const codeRepository = new CodeRepository(mockDBConnection);

      const result = await codeRepository.getFeatureTypeProperties();

      expect(result).to.be.eql([mockRow]);
      const statement = sqlStub.firstCall.args[0];
      expect(statement.text).to.not.include('is_default');
      expect(statement.text).to.not.include('blueprint_id =');
      expect(statement.text).to.not.include('bftp.record_end_date');
      expect(statement.text).to.not.include('bft.record_end_date');
      expect(statement.text).to.include('MIN(bftp.sort)');
    });
  });
});

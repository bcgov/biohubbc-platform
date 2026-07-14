import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { FEATURE_PROPERTY_TYPE } from '../models/feature-property';
import { FeatureType, FeatureTypeWithProperties } from '../models/feature-type';
import { FeatureTypeProperty } from '../models/feature-type-property';
import { CodeRepository } from './code-repository';

chai.use(sinonChai);

describe('CodeRepository', () => {
  describe('getFeatureTypes', async () => {
    afterEach(() => {
      sinon.restore();
    });

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

  describe('getFeatureTypePropertyCodes', async () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return rows if succeeds', async () => {
      const mockRow: FeatureTypeWithProperties = {
        feature_type: {
          feature_type_id: 1,
          name: 'survey',
          display_name: 'Survey',
          description: null
        },
        properties: [
          {
            feature_type_property_id: 2,
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

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const codeRepository = new CodeRepository(mockDBConnection);

      const result = await codeRepository.getFeatureTypePropertyCodes();

      expect(result).to.be.eql([mockRow]);
    });
  });

  describe('getFeaturePropertyByName', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const codeRepository = new CodeRepository(mockDBConnection);

      const featurePropertyName = 'name';

      try {
        await codeRepository.getFeaturePropertyByName(featurePropertyName);

        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect((error as ApiNotFoundError).message).to.equal('Feature property not found');
      }
    });

    it('should return row if succeeds', async () => {
      const mockRow: FeatureTypeProperty = {
        feature_type_property_id: 2,
        name: 'name',
        display_name: 'Name',
        description: 'Name',
        type_name: FEATURE_PROPERTY_TYPE.STRING,
        required_value: true,
        calculated_value: false,
        allow_multiple: false
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const codeRepository = new CodeRepository(mockDBConnection);

      const featurePropertyName = 'name';

      const result = await codeRepository.getFeaturePropertyByName(featurePropertyName);

      expect(result).to.be.eql(mockRow);
    });
  });
});

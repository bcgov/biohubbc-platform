import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { CodeRepository, FeaturePropertyCode, FeatureTypeCode } from './code-repository';

chai.use(sinonChai);

describe('CodeRepository', () => {
  describe('getFeatureTypes', async () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return rows if succeeds', async () => {
      const mockRow: FeatureTypeCode = {
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_type_display_name: 'Dataset'
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
      const mockRow: FeatureTypeCode & FeaturePropertyCode = {
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_type_display_name: 'Dataset',
        feature_property_id: 2,
        feature_property_name: 'name',
        feature_property_display_name: 'Name',
        feature_property_type_id: 3,
        feature_property_type_name: 'string'
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
        expect((error as Error).message).to.equal('Failed to get feature property record');
      }
    });

    it('should return row if succeeds', async () => {
      const mockRow: FeatureTypeCode & FeaturePropertyCode = {
        feature_type_id: 1,
        feature_type_name: 'dataset',
        feature_type_display_name: 'Dataset',
        feature_property_id: 2,
        feature_property_name: 'name',
        feature_property_display_name: 'Name',
        feature_property_type_id: 3,
        feature_property_type_name: 'string'
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

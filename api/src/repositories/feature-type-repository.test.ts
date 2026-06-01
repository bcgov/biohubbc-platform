import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { FeatureType } from '../models/feature-type';
import { FeatureTypeRepository } from './feature-type-repository';

chai.use(sinonChai);

const mockFeatureType: FeatureType = {
  feature_type_id: 1,
  name: 'dataset',
  display_name: 'Dataset',
  description: null
};

describe('FeatureTypeRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertFeatureType', () => {
    it('returns the inserted feature type', async () => {
      const mockResponse = { rowCount: 1, rows: [mockFeatureType] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypeRepository(mockConnection);

      const result = await repository.insertFeatureType({
        name: 'dataset',
        display_name: 'Dataset'
      });

      expect(result).to.eql(mockFeatureType);
    });

    it('throws when insert fails', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypeRepository(mockConnection);

      try {
        await repository.insertFeatureType({ name: 'dataset', display_name: 'Dataset' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert feature type');
      }
    });
  });

  describe('getFeatureType', () => {
    it('returns a feature type by ID', async () => {
      const mockResponse = { rowCount: 1, rows: [mockFeatureType] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypeRepository(mockConnection);

      const result = await repository.getFeatureType(1);
      expect(result).to.eql(mockFeatureType);
    });

    it('throws ApiNotFoundError when not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypeRepository(mockConnection);

      try {
        await repository.getFeatureType(999);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('getFeatureTypesCount', () => {
    it('returns the count of active feature types', async () => {
      const mockResponse = { rowCount: 1, rows: [{ count: 3 }] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypeRepository(mockConnection);

      const result = await repository.getFeatureTypesCount();
      expect(result).to.equal(3);
    });
  });

  describe('deleteFeatureType', () => {
    it('throws when no active row is deleted', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypeRepository(mockConnection);

      try {
        await repository.deleteFeatureType(999);
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to delete feature type');
      }
    });
  });
});

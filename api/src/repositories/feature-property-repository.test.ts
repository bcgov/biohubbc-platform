import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../errors/api-error';
import { FeatureProperty } from '../models/feature-property';
import { FeaturePropertyRepository } from './feature-property-repository';

chai.use(sinonChai);

const mockFeatureProperty: FeatureProperty = {
  feature_property_id: 1,
  feature_property_type_id: 2,
  name: 'guid',
  display_name: 'GUID',
  description: null,
  type_name: 'string',
  calculated_value: false
};

describe('FeaturePropertyRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertFeatureProperty', () => {
    it('returns the new feature_property_id', async () => {
      const mockResponse = { rowCount: 1, rows: [{ feature_property_id: 1 }] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      const result = await repository.insertFeatureProperty({
        feature_property_type_id: 2,
        name: 'guid',
        display_name: 'GUID'
      });

      expect(result).to.equal(1);
    });
  });

  describe('getFeatureProperty', () => {
    it('returns a feature property by ID', async () => {
      const mockResponse = { rowCount: 1, rows: [mockFeatureProperty] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      const result = await repository.getFeatureProperty(1);
      expect(result).to.eql(mockFeatureProperty);
    });

    it('throws ApiNotFoundError when not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      try {
        await repository.getFeatureProperty(999);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('updateFeatureProperty', () => {
    it('throws when no active row is updated', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeaturePropertyRepository(mockConnection);

      try {
        await repository.updateFeatureProperty(999, { display_name: 'Updated' });
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update feature property');
      }
    });
  });
});

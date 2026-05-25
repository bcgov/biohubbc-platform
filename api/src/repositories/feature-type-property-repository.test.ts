import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { AdminFeatureTypeProperty } from '../models/feature-type-property';
import { FeatureTypePropertyRepository } from './feature-type-property-repository';

chai.use(sinonChai);

const mockAdminFeatureTypeProperty: AdminFeatureTypeProperty = {
  feature_type_property_id: 1,
  feature_type_id: 10,
  feature_property_id: 20,
  required_value: false,
  sort: null
};

describe('FeatureTypePropertyRepository admin CRUD', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertFeatureTypeProperty', () => {
    it('returns the new feature_type_property_id', async () => {
      let callCount = 0;
      const mockConnection = getMockDBConnection({
        knex: async () => {
          callCount += 1;
          if (callCount === 1) {
            return { rowCount: 0, rows: [] } as unknown as QueryResult<any>;
          }
          return { rowCount: 1, rows: [{ feature_type_property_id: 1 }] } as unknown as QueryResult<any>;
        }
      });
      const repository = new FeatureTypePropertyRepository(mockConnection);

      const result = await repository.insertFeatureTypeProperty({
        feature_type_id: 10,
        feature_property_id: 20
      });

      expect(result).to.equal(1);
    });

    it('throws ApiConflictError when assignment already exists', async () => {
      const mockConnection = getMockDBConnection({
        knex: async () => ({ rowCount: 1, rows: [{ feature_type_property_id: 99 }] } as unknown as QueryResult<any>)
      });
      const repository = new FeatureTypePropertyRepository(mockConnection);

      try {
        await repository.insertFeatureTypeProperty({
          feature_type_id: 10,
          feature_property_id: 20
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
        expect((error as ApiConflictError).message).to.equal(
          'Feature property is already assigned to this feature type'
        );
      }
    });
  });

  describe('getAdminFeatureTypeProperty', () => {
    it('returns a scoped feature type property', async () => {
      const mockResponse = { rowCount: 1, rows: [mockAdminFeatureTypeProperty] } as unknown as Promise<
        QueryResult<any>
      >;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypePropertyRepository(mockConnection);

      const result = await repository.getAdminFeatureTypeProperty(1, 10);
      expect(result).to.eql(mockAdminFeatureTypeProperty);
    });

    it('throws ApiNotFoundError when scoped record is not found', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypePropertyRepository(mockConnection);

      try {
        await repository.getAdminFeatureTypeProperty(1, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('updateFeatureTypeProperty', () => {
    it('throws ApiNotFoundError when scoped update affects no rows', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypePropertyRepository(mockConnection);

      try {
        await repository.updateFeatureTypeProperty(1, 99, { required_value: true });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });

  describe('deleteFeatureTypeProperty', () => {
    it('throws ApiNotFoundError when scoped delete affects no rows', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repository = new FeatureTypePropertyRepository(mockConnection);

      try {
        await repository.deleteFeatureTypeProperty(1, 99);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });
});

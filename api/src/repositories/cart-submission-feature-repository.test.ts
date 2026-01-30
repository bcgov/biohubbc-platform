import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CartSubmissionFeature } from '../models/cart';
import { getMockDBConnection } from '../__mocks__/db';
import { CartSubmissionFeatureRepository } from './cart-submission-feature-repository';

chai.use(sinonChai);

describe('CartSubmissionFeatureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('addSubmissionFeaturesToCart', () => {
    it('should insert multiple submission features without error', async () => {
      const mockQueryResponse = {
        rowCount: 3,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.addSubmissionFeaturesToCart('cart-1', [1, 2, 3]);

      expect(result).to.be.undefined;
    });
  });

  describe('removeSubmissionFeaturesFromCart', () => {
    it('should remove submission features without error', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.removeSubmissionFeaturesFromCart('cart-1', ['uuid1']);

      expect(result).to.be.undefined;
    });
  });

  describe('clearCart', () => {
    it('should delete all submission features from cart', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.clearCart('cart-1');

      expect(result).to.be.undefined;
    });
  });

  describe('getCartSubmissionFeatures', () => {
    it('should return submission features from the cart', async () => {
      const mockRows: CartSubmissionFeature[] = [
        {
          submission_feature_id: 1,
          cart_submission_feature_id: 'uuid1',
          feature_type_name: 'Type1',
          feature_type_id: 2,
          secured: false,
          submission_id: 1
        },
        {
          submission_feature_id: 2,
          cart_submission_feature_id: 'uuid2',
          feature_type_name: 'Type2',
          feature_type_id: 3,
          secured: true,
          submission_id: 1
        }
      ];

      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatures('cart-1', { page: 1, limit: 25 });

      expect(result).to.eql(mockRows);
    });
  });

  describe('getCartSubmissionFeatureCount', () => {
    it('should return the correct count', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 5 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatureCount('cart-1');

      expect(result).to.eql(5);
    });
  });
});

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
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.addSubmissionFeaturesToCart('cart-1', [1, 2, 3]);

      expect(result).to.be.undefined;
    });

    it('should exclude actively secured features in the insert SQL', async () => {
      const sqlStub = sinon.stub().resolves({
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>);

      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.addSubmissionFeaturesToCart('cart-1', [1, 2, 3]);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlArg = sqlStub.firstCall.args[0] as { text?: string };
      const sqlText = sqlArg.text || '';

      expect(sqlText).to.contain('WHERE NOT EXISTS');
      expect(sqlText).to.contain('submission_feature_security');
      expect(sqlText).to.contain('sfs.record_end_date IS NULL');
    });
  });

  describe('removeSubmissionFeaturesFromCart', () => {
    it('should remove submission features without error', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>;

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
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.clearCart('cart-1');

      expect(result).to.be.undefined;
    });
  });

  describe('getCartSubmissionFeatureIds', () => {
    it('should return an array of submission feature IDs', async () => {
      const mockQueryResponse = {
        rowCount: 2,
        rows: [{ submission_feature_id: 1 }, { submission_feature_id: 2 }]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatureIds('cart-1');

      expect(result).to.eql([1, 2]);
    });

    it('should return an empty array when cart has no features', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatureIds('cart-1');

      expect(result).to.eql([]);
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
      } as unknown as QueryResult<any>;

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
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatureCount('cart-1');

      expect(result).to.eql(5);
    });
  });
});

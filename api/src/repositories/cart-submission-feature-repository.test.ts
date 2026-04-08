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

  describe('createUnsecuredCartSubmissionFeatures', () => {
    it('should insert multiple submission features without error', async () => {
      const mockQueryResponse = {
        rowCount: 3,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockQueryResponse });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.createUnsecuredCartSubmissionFeatures('cart-1', [1, 2, 3]);

      expect(result).to.be.undefined;
    });

    it('should use NOT EXISTS with recursive ancestor walk to block secured features', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>);

      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.createUnsecuredCartSubmissionFeatures('cart-1', [1, 2, 3]);

      expect(knexStub).to.have.been.calledOnce;
      const sqlText = knexStub.firstCall.args[0].toString();

      expect(sqlText).to.include('NOT EXISTS');
      expect(sqlText).to.include('RECURSIVE');
      expect(sqlText).to.include('ancestor_chain');
      expect(sqlText).to.include('submission_feature_security');
      expect(sqlText).to.include('record_effective_date');
      expect(sqlText).to.include('record_end_date');
    });
  });

  describe('createCartSubmissionFeaturesWithScopeCheck', () => {
    it('should use scope check SQL with recursive ancestor walk', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>);

      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.createCartSubmissionFeaturesWithScopeCheck('cart-1', [1, 2, 3], 42);

      expect(knexStub).to.have.been.calledOnce;
      const sqlText = knexStub.firstCall.args[0].toString();

      expect(sqlText).to.include('security_scope_anchor');
      expect(sqlText).to.include('team_security_scope');
      expect(sqlText).to.include('team_member');
      expect(sqlText).to.include('RECURSIVE');
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
    it('should return all features including secured ones', async () => {
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
      // Secured feature is included — no longer filtered out
      expect(result).to.have.length(2);
      expect(result[1].secured).to.be.true;
    });

    it('should return only the matching feature when submissionFeatureId is provided', async () => {
      const matchingFeature: CartSubmissionFeature = {
        submission_feature_id: 5,
        cart_submission_feature_id: 'uuid5',
        feature_type_name: 'Type1',
        feature_type_id: 2,
        secured: false,
        submission_id: 1
      };

      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [matchingFeature]
      } as unknown as QueryResult<any>);

      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatures('cart-1', { page: 1, limit: 25 }, 5);

      expect(result).to.eql([matchingFeature]);
    });
  });

  describe('getCartSubmissionFeatureCount', () => {
    it('should return the count of all features in the cart', async () => {
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

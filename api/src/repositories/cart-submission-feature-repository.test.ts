import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { getMockDBConnection } from '../__mocks__/db';
import { CartSubmissionFeatureRepository } from './cart-submission-feature-repository';
import { SubmissionFeature } from './submission-repository';

chai.use(sinonChai);

describe('CartSubmissionFeatureRepository', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('addSubmissionFeaturesToCart', () => {
    it('inserts multiple submission features without error', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves({ rowCount: 3 })
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.addSubmissionFeaturesToCart('cart-1', [1, 2, 3], 1);
      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });

    it('does nothing if submissionFeatureIds is empty', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves({ rowCount: 0 })
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.addSubmissionFeaturesToCart('cart-1', [], 1);
      expect(mockDBConnection.knex).to.not.have.been.called;
    });
  });

  describe('removeSubmissionFeaturesFromCart', () => {
    it('removes submission features without error', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves({ rowCount: 1 })
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.removeSubmissionFeaturesFromCart('cart-1', [10], 1);
      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });
  });

  describe('clearCart', () => {
    it('deletes all submission features from cart', async () => {
      const mockDBConnection = getMockDBConnection({
        knex: Sinon.stub().resolves({ rowCount: 2 })
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.clearCart('cart-1', 1);
      expect(mockDBConnection.knex).to.have.been.calledOnce;
    });
  });

  describe('getCartSubmissionFeatures', () => {
    it('returns submission features from the cart', async () => {
      const mockFeatures: SubmissionFeature[] = [
        {
          submission_feature_id: 1,
          uuid: 'uuid1',
          urn: 'urn1',
          submission_id: 1,
          feature_type_id: 1,
          source_id: 'source',
          data: {},
          feature_type_name: 'Type1',
          secured: false
        },
        {
          submission_feature_id: 2,
          uuid: 'uuid2',
          urn: 'urn2',
          submission_id: 2,
          feature_type_id: 2,
          source_id: 'source',
          data: {},
          feature_type_name: 'Type2',
          secured: true
        }
      ];

      const mockQueryResponse = {
        rowCount: mockFeatures.length,
        rows: mockFeatures
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatures('cart-1', 1, { page: 1, limit: 25 });

      expect(result).to.eql(mockFeatures);
    });
  });

  describe('getCartSubmissionFeatureCount', () => {
    it('returns the correct count', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ count: 5 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatureCount('cart-1', 1);

      expect(result).to.equal(5);
    });
  });
});

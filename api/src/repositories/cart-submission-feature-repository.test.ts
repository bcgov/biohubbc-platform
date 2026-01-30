import { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { CartSubmissionFeatureRepository } from './cart-submission-feature-repository';
import { SubmissionFeature } from './submission-repository';

chai.use(sinonChai);

describe('CartSubmissionFeatureRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('addSubmissionFeaturesToCart', () => {
    it('should insert multiple submission features without error', async () => {
      const mockRows = [{ rowCount: 3 }];
      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.addSubmissionFeaturesToCart('cart-1', 1, ['uuid1', 'uuid2', 'uuid3']);
      expect(mockDBConnection.knex).to.have.been.calledOnceWith(
        sinon.match.has('where', sinon.match.array.deepEquals(['cart_status', 'ACTIVE']))
      );
    });

    it('should do nothing if submissionFeatureIds is empty', async () => {
      const mockRows = [{ rowCount: 0 }];
      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.addSubmissionFeaturesToCart('cart-1', 1, []);
      expect(mockDBConnection.knex).to.not.have.been.called;
    });
  });

  describe('removeSubmissionFeaturesFromCart', () => {
    it('should remove submission features without error', async () => {
      const mockRows = [{ rowCount: 1 }];
      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.removeSubmissionFeaturesFromCart('cart-1', 1, ['uuid1']);
      expect(mockDBConnection.knex).to.have.been.calledOnceWith(
        sinon.match.has('where', sinon.match.array.deepEquals(['cart_status', 'ACTIVE']))
      );
    });

    it('should do nothing if submissionFeatureIds is empty', async () => {
      const mockRows = [{ rowCount: 0 }];
      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.removeSubmissionFeaturesFromCart('cart-1', 1, []);
      expect(mockDBConnection.knex).to.not.have.been.called;
    });
  });

  describe('clearCart', () => {
    it('should delete all submission features from cart', async () => {
      const mockRows = [{ rowCount: 2 }];
      const mockQueryResponse = {
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      await repo.clearCart('cart-1', 1);
      expect(mockDBConnection.knex).to.have.been.calledOnceWith(
        sinon.match.has('where', sinon.match.array.deepEquals(['cart_status', 'ACTIVE']))
      );
    });
  });

  describe('getCartSubmissionFeatures', () => {
    it('should return submission features from the cart', async () => {
      const mockRows: SubmissionFeature[] = [
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
        rowCount: mockRows.length,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatures('cart-1', 1, { page: 1, limit: 25 });

      expect(result).to.eql(mockRows);
      expect(mockDBConnection.knex).to.have.been.calledOnceWith(
        sinon.match.has('where', sinon.match.array.deepEquals(['cart_status', 'ACTIVE']))
      );
    });
  });

  describe('getCartSubmissionFeatureCount', () => {
    it('should return the correct count', async () => {
      const mockRows = [{ count: 5 }];
      const mockQueryResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new CartSubmissionFeatureRepository(mockDBConnection);

      const result = await repo.getCartSubmissionFeatureCount('cart-1', 1);

      expect(result).to.equal(5);
      expect(mockDBConnection.knex).to.have.been.calledOnceWith(
        sinon.match.has('where', sinon.match.array.deepEquals(['cart_status', 'ACTIVE']))
      );
    });
  });
});

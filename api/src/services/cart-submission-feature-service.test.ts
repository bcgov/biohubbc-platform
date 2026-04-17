import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiError } from '../errors/api-error';
import { CartFeatureListResponse, CartSubmissionFeature } from '../models/cart';
import { CartSubmissionFeatureRepository } from '../repositories/cart-submission-feature-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';

chai.use(sinonChai);

describe('CartSubmissionFeatureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createCartSubmissionFeatures', () => {
    it('should call scope-checked repository method for authenticated user', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'createCartSubmissionFeaturesWithScopeCheck')
        .resolves();

      const features: number[] = [1, 2, 3];
      await service.createCartSubmissionFeatures('cart-1', features, 42);

      expect(stub).to.have.been.calledOnceWith('cart-1', features, 42);
    });

    it('should call unsecured repository method for anonymous user', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'createUnsecuredCartSubmissionFeatures')
        .resolves();

      const features: number[] = [1, 2, 3];
      await service.createCartSubmissionFeatures('cart-1', features, null);

      expect(stub).to.have.been.calledOnceWith('cart-1', features);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'createCartSubmissionFeaturesWithScopeCheck')
        .rejects(new Error('DB error'));

      try {
        await service.createCartSubmissionFeatures('cart-1', [1, 2], 42);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });

    it('should not call repository when feature list is empty', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const unsecuredStub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'createUnsecuredCartSubmissionFeatures')
        .resolves();
      const scopeStub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'createCartSubmissionFeaturesWithScopeCheck')
        .resolves();

      await service.createCartSubmissionFeatures('cart-1', [], null);

      expect(unsecuredStub).not.to.have.been.called;
      expect(scopeStub).not.to.have.been.called;
    });
  });

  describe('removeSubmissionFeaturesFromCart', () => {
    it('should call repository with correct parameters', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'removeSubmissionFeaturesFromCart').resolves();

      await service.removeSubmissionFeaturesFromCart('cart-1', ['uuid1', 'uuid2']);

      expect(stub).to.have.been.calledOnceWith('cart-1', ['uuid1', 'uuid2']);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'removeSubmissionFeaturesFromCart')
        .rejects(new Error('DB error'));

      try {
        await service.removeSubmissionFeaturesFromCart('cart-1', ['uuid1', 'uuid2']);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });

    it('should not call repository when cart submission feature list is empty', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'removeSubmissionFeaturesFromCart').resolves();

      await service.removeSubmissionFeaturesFromCart('cart-1', []);

      expect(stub).not.to.have.been.called;
    });
  });

  describe('clearCart', () => {
    it('should call repository with correct parameters', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'clearCart').resolves();

      await service.clearCart('cart-1');

      expect(stub).to.have.been.calledOnceWith('cart-1');
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon.stub(CartSubmissionFeatureRepository.prototype, 'clearCart').rejects(new Error('DB error'));

      try {
        await service.clearCart('cart-1');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });
  });

  describe('getCartSubmissionFeatures', () => {
    it('should call repository with correct parameters and return features', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const features: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 1,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'name',
          secured: true
        }
      ];
      const stub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures')
        .resolves(features);

      const pagination: ApiPaginationOptions = { page: 1, limit: 10 };
      const result = await service.getCartSubmissionFeatures('cart-1', pagination);

      expect(stub).to.have.been.calledOnceWith('cart-1', pagination);
      expect(result).to.deep.equal(features);
    });

    it('should use default pagination when not provided', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures').resolves([]);

      await service.getCartSubmissionFeatures('cart-1');

      expect(stub).to.have.been.calledOnceWith('cart-1', undefined);
    });

    it('should pass submissionFeatureId filter to repository', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const features: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 5,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'name',
          secured: false
        }
      ];
      const stub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures')
        .resolves(features);

      const pagination: ApiPaginationOptions = { page: 1, limit: 10 };
      const result = await service.getCartSubmissionFeatures('cart-1', pagination, 5);

      expect(stub).to.have.been.calledOnceWith('cart-1', pagination, 5);
      expect(result).to.deep.equal(features);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures').rejects(new Error('DB error'));

      try {
        await service.getCartSubmissionFeatures('cart-1');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });
  });

  describe('getCartSubmissionFeatureCount', () => {
    it('should call repository with correct parameters and return count', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatureCount').resolves(5);

      const count = await service.getCartSubmissionFeatureCount('cart-1');

      expect(stub).to.have.been.calledOnceWith('cart-1');
      expect(count).to.equal(5);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatureCount')
        .rejects(new Error('DB error'));

      try {
        await service.getCartSubmissionFeatureCount('cart-1');
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });
  });

  describe('getPaginatedCartFeaturesResponse', () => {
    it('should return features and pagination response', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const features: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 1,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'name',
          secured: false
        }
      ];

      sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures').resolves(features);
      sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatureCount').resolves(1);

      const result: CartFeatureListResponse = await service.getPaginatedCartFeaturesResponse('cart-1', {
        page: 1,
        limit: 10
      });

      expect(result.features).to.deep.equal(features);
      expect(result.pagination.total).to.equal(1);
      expect(result.pagination.current_page).to.equal(1);
      expect(result.pagination.per_page).to.equal(10);
    });

    it('should pass submissionFeatureId to getCartSubmissionFeatures and return filtered response', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const features: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 5,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'name',
          secured: false
        }
      ];

      const featuresStub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures')
        .resolves(features);
      sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatureCount').resolves(10);

      const pagination: ApiPaginationOptions = { page: 1, limit: 10 };
      const result: CartFeatureListResponse = await service.getPaginatedCartFeaturesResponse('cart-1', pagination, 5);

      expect(featuresStub).to.have.been.calledOnceWith('cart-1', pagination, 5);
      expect(result.features).to.deep.equal(features);
    });
  });
});

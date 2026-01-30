import chai, { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiError } from '../errors/api-error';
import { CartSubmissionFeatureRepository } from '../repositories/cart-submission-feature-repository';
import { SubmissionFeature } from '../repositories/submission-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { getMockDBConnection } from '../__mocks__/db';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';

chai.use(sinonChai);

describe('CartSubmissionFeatureService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('addSubmissionFeaturesToCart', () => {
    it('should call repository with correct parameters', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'addSubmissionFeaturesToCart').resolves();

      const features: string[] = ['1', '2', '3'];
      await service.addSubmissionFeaturesToCart('cart-1', 1, features);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1, features);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'addSubmissionFeaturesToCart')
        .rejects(new Error('DB error'));

      try {
        await service.addSubmissionFeaturesToCart('cart-1', 1, ['1', '2']);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });
  });

  describe('removeSubmissionFeaturesFromCart', () => {
    it('should call repository with correct parameters', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'removeSubmissionFeaturesFromCart').resolves();

      await service.removeSubmissionFeaturesFromCart('cart-1', 1, ['uuid1', 'uuid2']);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1, ['uuid1', 'uuid2']);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'removeSubmissionFeaturesFromCart')
        .rejects(new Error('DB error'));

      try {
        await service.removeSubmissionFeaturesFromCart('cart-1', 1, ['uuid1', 'uuid2']);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });
  });

  describe('clearCart', () => {
    it('should call repository with correct parameters', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'clearCart').resolves();

      await service.clearCart('cart-1', 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon.stub(CartSubmissionFeatureRepository.prototype, 'clearCart').rejects(new Error('DB error'));

      try {
        await service.clearCart('cart-1', 1);
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

      const features: SubmissionFeature[] = [
        {
          submission_feature_id: 1,
          uuid: 'uuid',
          urn: 'urn:1:1:1',
          submission_id: 1,
          feature_type_id: 1,
          source_id: 'source',
          data: {},
          feature_type_name: 'name',
          secured: true
        }
      ];
      const stub = sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures')
        .resolves(features);

      const pagination: ApiPaginationOptions = { page: 1, limit: 10 };
      const result = await service.getCartSubmissionFeatures('cart-1', 1, pagination);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1, pagination);
      expect(result).to.deep.equal(features);
    });

    it('should use default pagination when not provided', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      const stub = sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures').resolves([]);

      await service.getCartSubmissionFeatures('cart-1', 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1, undefined);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon.stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatures').rejects(new Error('DB error'));

      try {
        await service.getCartSubmissionFeatures('cart-1', 1);
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

      const count = await service.getCartSubmissionFeatureCount('cart-1', 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1);
      expect(count).to.equal(5);
    });

    it('should propagate repository errors', async () => {
      const mockDB = getMockDBConnection();
      const service = new CartSubmissionFeatureService(mockDB);

      sinon
        .stub(CartSubmissionFeatureRepository.prototype, 'getCartSubmissionFeatureCount')
        .rejects(new Error('DB error'));

      try {
        await service.getCartSubmissionFeatureCount('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err) {
        expect(err).to.be.instanceOf(Error);
        expect((err as ApiError).message).to.equal('DB error');
      }
    });
  });
});

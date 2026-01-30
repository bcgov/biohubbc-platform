import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { Cart, CartStatus } from '../models/cart';
import { CartRepository } from '../repositories/cart-repository';
import { SubmissionFeature } from '../repositories/submission-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { CartService } from './cart-service';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';

chai.use(sinonChai);

describe('CartService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findCartWithFeaturesById', () => {
    it('should return a cart with features for a given cartId and systemUserId', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const mockFeatures: SubmissionFeature[] = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          urn: 'urn-1',
          submission_id: 1,
          feature_type_id: 1,
          source_id: null,
          data: {},
          feature_type_name: 'type-1',
          secured: false
        }
      ];

      sinon.stub(CartRepository.prototype, 'getCartById').resolves(mockCart);
      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves(mockFeatures);

      const result = await service.findCartWithFeaturesById('cart-1', 1);
      expect(result).to.deep.equal({ ...mockCart, features: mockFeatures });
    });
  });

  describe('getCartById', () => {
    it('should return a cart', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const stub = sinon.stub(CartRepository.prototype, 'getCartById').resolves(mockCart);

      const result = await service.getCartById('cart-1', 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1);
      expect(result).to.deep.equal(mockCart);
    });
  });

  describe('createCart', () => {
    it('should create a new cart without features when no submission feature IDs provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-123',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      sinon.stub(CartRepository.prototype, 'createCart').resolves(mockCart);

      const result = await service.createCart(1, []);

      expect(result).to.deep.equal({ ...mockCart, features: [] });
    });

    it('should create a new cart with features and return it', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-123',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const mockFeatures: SubmissionFeature[] = [
        {
          submission_feature_id: 1,
          uuid: 'uuid-1',
          urn: 'urn-1',
          submission_id: 1,
          feature_type_id: 1,
          source_id: null,
          data: {},
          feature_type_name: 'type-1',
          secured: false
        }
      ];

      sinon.stub(CartRepository.prototype, 'createCart').resolves(mockCart);
      const addStub = sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();
      const getStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures')
        .resolves(mockFeatures);

      const result = await service.createCart(1, ['uuid1']);

      expect(addStub).to.have.been.calledOnceWith('cart-123', ['uuid1'], 1);
      expect(getStub).to.have.been.calledOnce;
      expect(result).to.deep.equal({ ...mockCart, features: mockFeatures });
    });

    it('should propagate errors from repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'createCart').rejects(new Error('DB error'));

      try {
        await service.createCart(1, []);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('updateCart', () => {
    it('should update the cart successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const stub = sinon.stub(CartRepository.prototype, 'updateCart').resolves();

      const payload = { cart_status: CartStatus.CHECKED_OUT };

      await service.updateCart('cart-1', 1, payload);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1, payload);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'updateCart').rejects(new Error('DB error'));

      try {
        await service.updateCart('cart-1', 1, { cart_status: CartStatus.CHECKED_OUT });
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('deleteCart', () => {
    it('should delete a cart successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const stub = sinon.stub(CartRepository.prototype, 'deleteCart').resolves();

      await service.deleteCart('cart-1', 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'deleteCart').rejects(new Error('DB error'));

      try {
        await service.deleteCart('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });
});

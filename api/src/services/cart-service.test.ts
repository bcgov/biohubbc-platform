import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { HTTP400, HTTP401 } from '../errors/http-error';
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

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(mockCart);
      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves(mockFeatures);

      const result = await service.findCartWithFeaturesById('cart-1', 1);
      expect(result).to.deep.equal({ ...mockCart, features: mockFeatures });
    });

    it('should throw HTTP401 if cart not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(null);

      try {
        await service.findCartWithFeaturesById('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP401);
        expect(err.message).to.equal('Access Denied');
      }
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

      const result = await service.createCart(1, [1]);

      expect(addStub).to.have.been.calledOnceWith('cart-123', [1], 1);
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

  describe('updateCartStatus', () => {
    it('should update the status of the cart successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const stub = sinon.stub(CartRepository.prototype, 'updateCartStatus').resolves();

      await service.updateCartStatus('cart-1', CartStatus.CHECKED_OUT, 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', CartStatus.CHECKED_OUT, 1);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'updateCartStatus').rejects(new Error('DB error'));

      try {
        await service.updateCartStatus('cart-1', CartStatus.CHECKED_OUT, 1);
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

  describe('updateCartFeatures', () => {
    it('should add and remove features from cart', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(mockCart);
      const addStub = sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();
      const removeStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'removeSubmissionFeaturesFromCart')
        .resolves();

      await service.updateCartFeatures('cart-1', 1, { add: [1, 2], remove: [3] });

      expect(addStub).to.have.been.calledOnceWith('cart-1', [1, 2], 1);
      expect(removeStub).to.have.been.calledOnceWith('cart-1', [3], 1);
    });

    it('should throw HTTP400 if cart is not active', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const inactiveCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ABANDONED
      };

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(inactiveCart);
      const addStub = sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();
      const removeStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'removeSubmissionFeaturesFromCart')
        .resolves();

      try {
        await service.updateCartFeatures('cart-1', 1, { add: [1], remove: [] });
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP400);
        expect(err.message).to.equal('Cart is not active');
      }
      expect(addStub).not.to.have.been.called;
      expect(removeStub).not.to.have.been.called;
    });

    it('should throw HTTP400 if cart not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(null);
      const addStub = sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();
      const removeStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'removeSubmissionFeaturesFromCart')
        .resolves();

      try {
        await service.updateCartFeatures('cart-1', 1, { add: [1], remove: [] });
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP400);
        expect(err.message).to.equal('Cart not found');
      }
      expect(addStub).not.to.have.been.called;
      expect(removeStub).not.to.have.been.called;
    });
  });

  describe('clearCart', () => {
    it('should validate cart and call CartSubmissionFeatureService', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(mockCart);
      const stub = sinon.stub(CartSubmissionFeatureService.prototype, 'clearCart').resolves();

      await service.clearCart('cart-1', 1);

      expect(stub).to.have.been.calledOnceWith('cart-1', 1);
    });

    it('should throw HTTP400 if cart is not active', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const inactiveCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ABANDONED
      };

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(inactiveCart);
      const stub = sinon.stub(CartSubmissionFeatureService.prototype, 'clearCart').resolves();

      try {
        await service.clearCart('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP400);
        expect(err.message).to.equal('Cart is not active');
      }
      expect(stub).not.to.have.been.called;
    });

    it('should throw HTTP400 if cart not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(null);
      const stub = sinon.stub(CartSubmissionFeatureService.prototype, 'clearCart').resolves();

      try {
        await service.clearCart('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP400);
        expect(err.message).to.equal('Cart not found');
      }
      expect(stub).not.to.have.been.called;
    });
  });

  describe('getCartSubmissionFeatures', () => {
    it('should validate cart and return features', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const mockFeatures: SubmissionFeature[] = [];

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(mockCart);
      const stub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures')
        .resolves(mockFeatures);

      const result = await service.getCartSubmissionFeatures('cart-1', 1, {
        page: 1,
        limit: 10
      });

      expect(stub).to.have.been.calledOnce;
      expect(result).to.deep.equal(mockFeatures);
    });

    it('should validate cart and return features without pagination', async () => {
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

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(mockCart);
      const stub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures')
        .resolves(mockFeatures);

      const result = await service.getCartSubmissionFeatures('cart-1', 1);

      expect(stub).to.have.been.calledOnce;
      expect(result).to.deep.equal(mockFeatures);
    });

    it('should throw HTTP400 if cart is not active', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const inactiveCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ABANDONED
      };

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(inactiveCart);
      const stub = sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves([]);

      try {
        await service.getCartSubmissionFeatures('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP400);
        expect(err.message).to.equal('Cart is not active');
      }
      expect(stub).not.to.have.been.called;
    });

    it('should throw HTTP400 if cart not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'findCartById').resolves(null);
      const stub = sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves([]);

      try {
        await service.getCartSubmissionFeatures('cart-1', 1);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(HTTP400);
        expect(err.message).to.equal('Cart not found');
      }
      expect(stub).not.to.have.been.called;
    });
  });
});

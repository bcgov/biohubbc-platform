import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Cart, CartFeatureListResponse, CartStatus, CartSubmissionFeature, UpdateCart } from '../models/cart';
import * as publisher from '../queue/publisher';
import { CartRepository } from '../repositories/cart-repository';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { getMockDBConnection } from '../__mocks__/db';
import { CartService } from './cart-service';
import { CartSubmissionFeatureService } from './cart-submission-feature-service';
import { DownloadService } from './download/download-service';

chai.use(sinonChai);

describe('CartService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findCartWithFeaturesById', () => {
    it('should return a cart with features for a given cartId', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-1',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const mockFeatures: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 1,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'type-1',
          secured: false
        }
      ];

      sinon.stub(CartRepository.prototype, 'getCartById').resolves(mockCart);
      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves(mockFeatures);

      const result = await service.findCartWithFeaturesById('cart-1');
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

      const result = await service.getCartById('cart-1');

      expect(stub).to.have.been.calledOnceWith('cart-1');
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

      const mockPaginationResponse: CartFeatureListResponse = {
        features: [],
        pagination: {
          current_page: 1,
          last_page: 1,
          total: 0,
          per_page: 25,
          order: 'asc' as const,
          sort: 'cart_submission_feature_id'
        }
      };

      sinon.stub(CartRepository.prototype, 'createCart').resolves(mockCart);
      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .resolves(mockPaginationResponse);

      const result = await service.createCart(1, []);

      expect(result).to.deep.equal({
        cart: mockCart,
        features: mockPaginationResponse.features,
        pagination: mockPaginationResponse.pagination
      });
    });

    it('should create a new cart with features and return cart, features, and pagination', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-123',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const mockFeatures: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 1,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'type-1',
          secured: false
        }
      ];

      const mockPaginationResponse: CartFeatureListResponse = {
        features: mockFeatures,
        pagination: {
          current_page: 1,
          last_page: 1,
          total: 1,
          per_page: 25,
          order: 'asc' as const,
          sort: 'cart_submission_feature_id'
        }
      };

      sinon.stub(CartRepository.prototype, 'createCart').resolves(mockCart);
      const addStub = sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();
      const getStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .resolves(mockPaginationResponse);

      const result = await service.createCart(1, [1]);

      expect(addStub).to.have.been.calledOnceWith('cart-123', [1]);
      expect(getStub).to.have.been.calledOnce;
      expect(result).to.deep.equal({
        cart: mockCart,
        features: mockPaginationResponse.features,
        pagination: mockPaginationResponse.pagination
      });
    });

    it('should use provided pagination options', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-123',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      const mockPaginationResponse: CartFeatureListResponse = {
        features: [],
        pagination: {
          current_page: 1,
          last_page: 1,
          total: 0,
          per_page: 10,
          order: 'asc' as const,
          sort: 'cart_submission_feature_id'
        }
      };

      sinon.stub(CartRepository.prototype, 'createCart').resolves(mockCart);
      const getStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .resolves(mockPaginationResponse);

      const pagination: ApiPaginationOptions = { page: 2, limit: 10 };
      const result = await service.createCart(1, [], pagination);

      expect(getStub).to.have.been.calledOnceWith('cart-123', pagination);
      expect(result).to.deep.equal({
        cart: mockCart,
        features: mockPaginationResponse.features,
        pagination: mockPaginationResponse.pagination
      });
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

    it('should propagate errors from CartSubmissionFeatureService', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const mockCart: Cart = {
        cart_id: 'cart-123',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE
      };

      sinon.stub(CartRepository.prototype, 'createCart').resolves(mockCart);
      sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();
      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .rejects(new Error('Service error'));

      try {
        await service.createCart(1, [1]);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('Service error');
      }
    });
  });

  describe('checkoutCart', () => {
    it('should create a download, link features, check out the cart, and publish download job', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const getIdsStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureIds')
        .resolves([1, 2, 3]);
      const createDownloadStub = sinon
        .stub(DownloadService.prototype, 'createDownload')
        .resolves({ download_id: 'dl-uuid' });
      const createFeaturesStub = sinon.stub(DownloadService.prototype, 'createDownloadFeatures').resolves();
      const updateCartStub = sinon.stub(CartRepository.prototype, 'updateCart').resolves();
      const publishStub = sinon
        .stub(publisher, 'publishProcessDownloadJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const result = await service.checkoutCart('cart-1', 42);

      expect(result).to.deep.equal({ download_id: 'dl-uuid' });
      expect(getIdsStub).to.have.been.calledOnceWith('cart-1');
      expect(createDownloadStub).to.have.been.calledOnceWith(null, null, undefined, 42);
      expect(createFeaturesStub).to.have.been.calledOnceWith('dl-uuid', [1, 2, 3]);
      expect(updateCartStub).to.have.been.calledOnceWith('cart-1', {
        cart_status: CartStatus.CHECKED_OUT,
        checkout_date: sinon.match.string,
        checkout_user: 42
      });
      expect(publishStub).to.have.been.calledOnceWith(mockDBConnection, { downloadId: 'dl-uuid' });
    });

    it('should throw HTTP400 when cart is empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureIds').resolves([]);
      const createDownloadStub = sinon.stub(DownloadService.prototype, 'createDownload');
      const createFeaturesStub = sinon.stub(DownloadService.prototype, 'createDownloadFeatures');
      const updateCartStub = sinon.stub(CartRepository.prototype, 'updateCart');
      const publishStub = sinon.stub(publisher, 'publishProcessDownloadJob');

      try {
        await service.checkoutCart('cart-1', 42);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('Cannot checkout an empty cart');
        expect(err.status).to.equal(400);
      }

      expect(createDownloadStub).to.not.have.been.called;
      expect(createFeaturesStub).to.not.have.been.called;
      expect(updateCartStub).to.not.have.been.called;
      expect(publishStub).to.not.have.been.called;
    });

    it('should forward systemUserId for authenticated users', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureIds').resolves([1]);
      const createDownloadStub = sinon
        .stub(DownloadService.prototype, 'createDownload')
        .resolves({ download_id: 'dl-uuid' });
      sinon.stub(DownloadService.prototype, 'createDownloadFeatures').resolves();
      const updateCartStub = sinon.stub(CartRepository.prototype, 'updateCart').resolves();
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      await service.checkoutCart('cart-1', 7);

      expect(createDownloadStub).to.have.been.calledOnceWith(null, null, undefined, 7);
      expect(updateCartStub).to.have.been.calledOnceWith('cart-1', {
        cart_status: CartStatus.CHECKED_OUT,
        checkout_date: sinon.match.string,
        checkout_user: 7
      });
    });

    it('should forward null systemUserId for anonymous users', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureIds').resolves([1]);
      const createDownloadStub = sinon
        .stub(DownloadService.prototype, 'createDownload')
        .resolves({ download_id: 'dl-uuid' });
      sinon.stub(DownloadService.prototype, 'createDownloadFeatures').resolves();
      const updateCartStub = sinon.stub(CartRepository.prototype, 'updateCart').resolves();
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      await service.checkoutCart('cart-1', null);

      expect(createDownloadStub).to.have.been.calledOnceWith(null, null, undefined, null);
      expect(updateCartStub).to.have.been.calledOnceWith('cart-1', {
        cart_status: CartStatus.CHECKED_OUT,
        checkout_date: sinon.match.string,
        checkout_user: null
      });
    });

    it('should propagate errors and not call subsequent steps', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureIds').resolves([1, 2]);
      sinon.stub(DownloadService.prototype, 'createDownload').rejects(new Error('DB error'));
      const createFeaturesStub = sinon.stub(DownloadService.prototype, 'createDownloadFeatures');
      const updateCartStub = sinon.stub(CartRepository.prototype, 'updateCart');
      const publishStub = sinon.stub(publisher, 'publishProcessDownloadJob');

      try {
        await service.checkoutCart('cart-1', 42);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }

      expect(createFeaturesStub).to.not.have.been.called;
      expect(updateCartStub).to.not.have.been.called;
      expect(publishStub).to.not.have.been.called;
    });
  });

  describe('updateCart', () => {
    it('should update the cart successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      const stub = sinon.stub(CartRepository.prototype, 'updateCart').resolves();

      const payload: UpdateCart = { cart_status: CartStatus.CHECKED_OUT };

      await service.updateCart('cart-1', payload);

      expect(stub).to.have.been.calledOnceWith('cart-1', payload);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'updateCart').rejects(new Error('DB error'));

      try {
        await service.updateCart('cart-1', { cart_status: CartStatus.CHECKED_OUT });
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

      await service.deleteCart('cart-1');

      expect(stub).to.have.been.calledOnceWith('cart-1');
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new CartService(mockDBConnection);

      sinon.stub(CartRepository.prototype, 'deleteCart').rejects(new Error('DB error'));

      try {
        await service.deleteCart('cart-1');
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });
});

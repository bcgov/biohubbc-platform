import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { claimCartForCurrentUser, getCartWithFeaturesById } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { ApiError } from '../../../errors/api-error';
import { CartStatus } from '../../../models/cart';
import { CartService } from '../../../services/cart-service';
import { CartSubmissionFeatureService } from '../../../services/cart-submission-feature-service';

chai.use(sinonChai);

describe('cart/{cartId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getCartWithFeaturesById', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 with cart, features, and pagination', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

      const fakeCart = {
        cart_id: 'cart-123',
        system_user_id: null,
        cart_status: CartStatus.ACTIVE,
        record_end_date: null
      };

      const fakePaginatedResponse = {
        features: [
          {
            cart_submission_feature_id: 'uuid-1',
            submission_feature_id: 1,
            submission_id: 1,
            feature_type_id: 1,
            feature_type_name: 'type-1',
            secured: false
          }
        ],
        pagination: {
          current_page: 1,
          last_page: 1,
          total: 1,
          per_page: 25,
          order: 'asc' as const,
          sort: 'cart_submission_feature_id'
        }
      };

      sinon.stub(CartService.prototype, 'getCartById').resolves(fakeCart);
      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .resolves(fakePaginatedResponse);

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-123';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        cart: fakeCart,
        features: fakePaginatedResponse.features,
        pagination: fakePaginatedResponse.pagination
      });
    });

    it('returns 200 with empty features', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

      const fakeCart = {
        cart_id: 'cart-123',
        system_user_id: null,
        cart_status: CartStatus.ACTIVE,
        record_end_date: null
      };

      const fakePaginatedResponse = {
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

      sinon.stub(CartService.prototype, 'getCartById').resolves(fakeCart);
      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .resolves(fakePaginatedResponse);

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-123';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        cart: fakeCart,
        features: fakePaginatedResponse.features,
        pagination: fakePaginatedResponse.pagination
      });
    });

    it('sets default pagination values when no pagination is provided', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

      const fakeCart = {
        cart_id: 'cart-123',
        system_user_id: null,
        cart_status: CartStatus.ACTIVE,
        record_end_date: null
      };

      const fakePaginatedResponse = {
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

      sinon.stub(CartService.prototype, 'getCartById').resolves(fakeCart);
      const getPaginatedCartFeaturesResponseStub = sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .resolves(fakePaginatedResponse);

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-123';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getPaginatedCartFeaturesResponseStub).to.have.been.calledOnceWith('cart-123', {
        page: 1,
        limit: 25,
        sort: undefined,
        order: undefined
      });
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
    });

    it('rolls back and rethrows if CartService.getCartById throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
      sinon.stub(CartService.prototype, 'getCartById').rejects(new Error('Service error'));

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-123';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('rolls back and rethrows if CartSubmissionFeatureService.getPaginatedCartFeaturesResponse throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

      const fakeCart = {
        cart_id: 'cart-123',
        system_user_id: null,
        cart_status: CartStatus.ACTIVE,
        record_end_date: null
      };

      sinon.stub(CartService.prototype, 'getCartById').resolves(fakeCart);
      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse')
        .rejects(new Error('Service error'));

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-123';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('rolls back and rethrows if cart does not exist', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
      sinon.stub(CartService.prototype, 'getCartById').rejects(new Error('Cart not found'));
      sinon.stub(CartSubmissionFeatureService.prototype, 'getPaginatedCartFeaturesResponse');

      const requestHandler = getCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'missing-cart';
      mockReq.keycloak_token = null;
      mockReq.query = {};

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Cart not found');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });

  describe('claimCartForCurrentUser', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = claimCartForCurrentUser();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.keycloak_token = { sub: 'user-id' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 if cart is successfully claimed', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        systemUserId: sinon.stub().returns(1)
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const fakeCartId = '5555-6666-7777-8888';

      sinon.stub(CartService.prototype, 'updateCart').resolves();

      const requestHandler = claimCartForCurrentUser();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = fakeCartId;
      mockReq.keycloak_token = { sub: 'user-id' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.sendStatus).to.have.been.calledWith(200);
    });

    it('rolls back and rethrows if CartService.updateCart throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        systemUserId: sinon.stub().returns(1)
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const fakeCartId = '5555-6666-7777-8888';

      sinon.stub(CartService.prototype, 'updateCart').rejects(new Error('Service error'));

      const requestHandler = claimCartForCurrentUser();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = fakeCartId;
      mockReq.keycloak_token = { sub: 'user-id' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { findCartWithFeaturesById } from '.';
import * as db from '../../../database/db';
import { ApiError } from '../../../errors/api-error';
import { CartStatus, CartWithFeatures } from '../../../models/cart';
import { CartService } from '../../../services/cart-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';

chai.use(sinonChai);

describe('cart/{cartId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findCartWithFeaturesById', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = findCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 with cart with features if found', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fakeCart: CartWithFeatures = {
        cart_id: '5555-6666-7777-8888',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE,
        features: [
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
        ]
      };

      sinon.stub(CartService.prototype, 'findCartWithFeaturesById').resolves(fakeCart);

      const requestHandler = findCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = fakeCart.cart_id;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(fakeCart);
    });

    it('returns 200 with cart with empty features if no features exist', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fakeCart: CartWithFeatures = {
        cart_id: '5555-6666-7777-8888',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE,
        features: []
      };

      sinon.stub(CartService.prototype, 'findCartWithFeaturesById').resolves(fakeCart);

      const requestHandler = findCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = fakeCart.cart_id;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(fakeCart);
    });

    it('rolls back and rethrows if CartService.findCartWithFeaturesById throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();
      sinon.stub(CartService.prototype, 'findCartWithFeaturesById').rejects(new Error('Service error'));

      const requestHandler = findCartWithFeaturesById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'non-existent-session';

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

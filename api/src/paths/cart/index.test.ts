import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createCart } from '.';
import * as db from '../../database/db';
import { ApiError } from '../../errors/api-error';
import { CartStatus, CartWithFeatures } from '../../models/cart';
import { CartService } from '../../services/cart-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';

chai.use(sinonChai);

describe('cart', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createCart', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = createCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('calls CartService.createCart and returns 201 with cart', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fakeCart: CartWithFeatures = {
        cart_id: '1111-2222-3333-4444',
        system_user_id: 1,
        cart_status: CartStatus.ACTIVE,
        features: []
      };

      const createCartStub = sinon.stub(CartService.prototype, 'createCart').resolves(fakeCart);

      const requestHandler = createCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createCartStub).to.have.been.calledOnceWith(mockDBConnection.systemUserId());
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(fakeCart);
    });

    it('uses API user DB connection if no keycloak token present', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      const apiDBStub = sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const fakeCart: CartWithFeatures = {
        cart_id: '1111-2222-3333-4444',
        system_user_id: null,
        cart_status: CartStatus.ACTIVE,
        features: []
      };

      sinon.stub(CartService.prototype, 'createCart').resolves(fakeCart);

      const requestHandler = createCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = null;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(apiDBStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(fakeCart);
    });

    it('rolls back and rethrows if CartService.createCart throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(CartService.prototype, 'createCart').rejects(new Error('Service error'));

      const requestHandler = createCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

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

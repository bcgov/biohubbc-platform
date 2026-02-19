import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { checkoutCart } from '.';
import * as db from '../../../../database/db';
import { ApiError } from '../../../../errors/api-error';
import { CartService } from '../../../../services/cart-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('cart/{cartId}/checkout', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('checkoutCart', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = checkoutCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.keycloak_token = null;

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 201 with download_id for authenticated user', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        systemUserId: sinon.stub().returns(42)
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fakeResult = { download_id: 'dl-uuid-1234' };
      const checkoutCartStub = sinon.stub(CartService.prototype, 'checkoutCart').resolves(fakeResult);

      const requestHandler = checkoutCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-uuid-5678';
      mockReq.keycloak_token = { sub: 'user-id' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(checkoutCartStub).to.have.been.calledOnceWith('cart-uuid-5678', 42);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(fakeResult);
    });

    it('returns 201 with download_id for anonymous user', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      const apiDBStub = sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const fakeResult = { download_id: 'dl-uuid-anon' };
      const checkoutCartStub = sinon.stub(CartService.prototype, 'checkoutCart').resolves(fakeResult);

      const requestHandler = checkoutCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-uuid-anon';
      mockReq.keycloak_token = null;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(apiDBStub).to.have.been.calledOnce;
      expect(checkoutCartStub).to.have.been.calledOnceWith('cart-uuid-anon', null);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql(fakeResult);
    });

    it('rolls back and rethrows if CartService.checkoutCart throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        systemUserId: sinon.stub().returns(42)
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(CartService.prototype, 'checkoutCart').rejects(new Error('Checkout failed'));

      const requestHandler = checkoutCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-uuid-5678';
      mockReq.keycloak_token = { sub: 'user-id' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Checkout failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { checkoutCart } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { ApiError } from '../../../../errors/api-error';
import { HTTP400 } from '../../../../errors/http-error';
import { CartService } from '../../../../services/cart-service';

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
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
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

    it('rolls back and rethrows HTTP400 from CartService.checkoutCart', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub(),
        systemUserId: sinon.stub().returns(42)
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const checkoutCartStub = sinon
        .stub(CartService.prototype, 'checkoutCart')
        .rejects(new HTTP400('Cart checkout is being retired.'));

      const requestHandler = checkoutCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-uuid-5678';
      mockReq.keycloak_token = { sub: 'user-id' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
        expect((error as HTTP400).status).to.equal(400);
      }

      expect(checkoutCartStub).to.have.been.calledOnceWith('cart-uuid-5678', 42);
      expect(mockDBConnection.commit).to.not.have.been.called;
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    });

    it('rolls back and rethrows HTTP400 for anonymous user', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      const apiDBStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

      const checkoutCartStub = sinon
        .stub(CartService.prototype, 'checkoutCart')
        .rejects(new HTTP400('Cart checkout is being retired.'));

      const requestHandler = checkoutCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'cart-uuid-anon';
      mockReq.keycloak_token = null;

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw HTTP400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
      }

      expect(apiDBStub).to.have.been.calledOnce;
      expect(checkoutCartStub).to.have.been.calledOnceWith('cart-uuid-anon', null);
      expect(mockDBConnection.commit).to.not.have.been.called;
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    });
  });
});

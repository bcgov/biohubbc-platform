import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { addSubmissionFeaturesToCart, clearCartSubmissionFeatures, getCartSubmissionFeatures } from '.';
import * as db from '../../../../database/db';
import { HTTP500 } from '../../../../errors/http-error';
import { CartSubmissionFeature } from '../../../../models/cart';
import { CartSubmissionFeatureService } from '../../../../services/cart-submission-feature-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('cart/{cartId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getCartSubmissionFeatures', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as HTTP500).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 with cart features and pagination', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fakeFeatures: CartSubmissionFeature[] = [
        {
          cart_submission_feature_id: 'uuid-1',
          submission_feature_id: 1,
          submission_id: 1,
          feature_type_id: 1,
          feature_type_name: 'feature-1',
          secured: true
        },
        {
          cart_submission_feature_id: 'uuid-2',
          submission_feature_id: 2,
          submission_id: 1,
          feature_type_id: 2,
          feature_type_name: 'feature-2',
          secured: false
        }
      ];

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves(fakeFeatures);
      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureCount').resolves(2);

      const requestHandler = getCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.query = { page: '1', limit: '10' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.have.property('features');
      expect(mockRes.jsonValue).to.have.property('pagination');
      expect(mockRes.jsonValue.features).to.deep.equal(fakeFeatures);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    });

    it('returns 200 with features using default pagination if not provided', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const fakeFeatures: CartSubmissionFeature[] = [];

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves(fakeFeatures);
      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureCount').resolves(0);

      const requestHandler = getCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.query = {};

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.have.property('features');
      expect(mockRes.jsonValue).to.have.property('pagination');
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
    });

    it('rolls back and rethrows if CartSubmissionFeatureService.getCartSubmissionFeatures throws an error', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures')
        .rejects(new Error('Service error'));

      const requestHandler = getCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.query = {};

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('rolls back and rethrows if getCartSubmissionFeatureCount throws an error', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      sinon.stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatures').resolves([]);
      sinon
        .stub(CartSubmissionFeatureService.prototype, 'getCartSubmissionFeatureCount')
        .rejects(new Error('Count error'));

      const requestHandler = getCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.query = {};

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Count error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });

  describe('addSubmissionFeaturesToCart', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = addSubmissionFeaturesToCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = { features: ['uuid-1', 'uuid-2'] };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as HTTP500).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('adds and removes features successfully from the cart', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();

      const requestHandler = addSubmissionFeaturesToCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = { features: ['uuid-1', 'uuid-2'] };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
    });

    it('handles empty add and remove arrays', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart').resolves();

      const requestHandler = addSubmissionFeaturesToCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = { features: [] };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
    });

    it('rolls back and rethrows if CartService.addSubmissionFeaturesToCart throws an error', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      sinon
        .stub(CartSubmissionFeatureService.prototype, 'addSubmissionFeaturesToCart')
        .rejects(new Error('Service error'));

      const requestHandler = addSubmissionFeaturesToCart();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = { features: ['uuid-1'] };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Service error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });

  describe('clearCartSubmissionFeatures', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = clearCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as HTTP500).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('clears all features from cart successfully', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(CartSubmissionFeatureService.prototype, 'clearCart').resolves();

      const requestHandler = clearCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
    });

    it('rolls back and rethrows if CartSubmissionFeatureService.clearCart throws an error', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      sinon.stub(CartSubmissionFeatureService.prototype, 'clearCart').rejects(new Error('Clear error'));

      const requestHandler = clearCartSubmissionFeatures();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Clear error');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});

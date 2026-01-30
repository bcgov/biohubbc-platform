import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { postCartDownload } from '.';
import * as db from '../../../../database/db';
import { HTTP500 } from '../../../../errors/http-error';
import { CartDownloadService } from '../../../../services/cart-download-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';

chai.use(sinonChai);

describe('cart/{cartId}/download', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('postCartDownload', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = postCartDownload();
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

    it('throws error if email is not provided and user is not logged in', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      const requestHandler = postCartDownload();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.system_user = null;
      mockReq.body = {}; // No email in body

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as HTTP500).message).to.equal('Email is required');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('submits the cart download request successfully if email is provided', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      const fakeCartDownloadService = {
        submitDownload: sinon.stub().resolves() // Stubbing submitDownload method
      };
      sinon.stub(CartDownloadService.prototype, 'submitDownload').callsFake(fakeCartDownloadService.submitDownload);

      const requestHandler = postCartDownload();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = { email: 'user@example.com' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(fakeCartDownloadService.submitDownload).to.have.been.calledOnceWith('fake-cart-id', 'user@example.com');
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
    });

    it('submits the cart download request successfully if user is logged in', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      const fakeCartDownloadService = {
        submitDownload: sinon.stub().resolves() // Stubbing submitDownload method
      };
      sinon.stub(CartDownloadService.prototype, 'submitDownload').callsFake(fakeCartDownloadService.submitDownload);

      const requestHandler = postCartDownload();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = {}; // no email, will use logged-in user
      mockReq.system_user = { email: 'user@example.com' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(fakeCartDownloadService.submitDownload).to.have.been.calledOnceWith('fake-cart-id', 'user@example.com');
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(201);
    });

    it('rolls back and rethrows if CartDownloadService.submitDownload throws an error', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').resolves();

      // Stubbing to simulate an error in submitDownload
      sinon.stub(CartDownloadService.prototype, 'submitDownload').rejects(new Error('Service error'));

      const requestHandler = postCartDownload();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.cartId = 'fake-cart-id';
      mockReq.body = { email: 'user@example.com' };

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
});

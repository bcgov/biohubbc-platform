import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { GCNotifyService } from '../../../services/gcnotify-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { requestAccess } from './requestAccess';

chai.use(sinonChai);

describe('requestAccess', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return true upon success', async () => {
    const mockDBConnection = getMockDBConnection();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(GCNotifyService.prototype, 'sendNotificationForArtifactRequestAccess').resolves(true);

    const requestHandler = requestAccess();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.jsonValue).to.eql(true);
  });

  it('should return false upon failure', async () => {
    const mockDBConnection = getMockDBConnection();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(GCNotifyService.prototype, 'sendNotificationForArtifactRequestAccess').resolves(false);

    const requestHandler = requestAccess();
    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.jsonValue).to.eql(false);
  });

  it('should catch and rethrow errors', async () => {
    const mockDBConnection = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
    sinon.stub(GCNotifyService.prototype, 'sendNotificationForArtifactRequestAccess').throws(new Error('test error'));

    const requestHandler = requestAccess();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as Error).message).to.equal('test error');
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockDBConnection.rollback).to.have.been.calledOnce;
    }
  });
});

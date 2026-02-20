import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { deleteDataRequest, getDataRequestById, updateDataRequest } from '.';
import * as db from '../../../database/db';
import { ApiError } from '../../../errors/api-error';
import { DataRequest, DataRequestWithStatus } from '../../../models/data-request';
import { DataRequestService } from '../../../services/data-request-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';

chai.use(sinonChai);

describe('data-request/{dataRequestId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequestWithStatus: DataRequestWithStatus = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1,
    data_request_status: {
      data_request_status_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      comment_id: null,
      request_status: 'REQUESTED'
    }
  };

  const mockDataRequest: DataRequest = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1
  };

  describe('getDataRequestById', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = getDataRequestById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequestWithStatus.data_request_id;

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 with data request', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const stub = sinon.stub(DataRequestService.prototype, 'getDataRequestById').resolves(mockDataRequestWithStatus);

      const requestHandler = getDataRequestById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequestWithStatus.data_request_id;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(stub).to.have.been.calledOnceWith(mockDataRequestWithStatus.data_request_id);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockDataRequestWithStatus);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(DataRequestService.prototype, 'getDataRequestById').rejects(new Error('Service error'));

      const requestHandler = getDataRequestById();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequestWithStatus.data_request_id;

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

  describe('updateDataRequest', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = updateDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequest.data_request_id;
      mockReq.body = { reason: 'Updated reason' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 with updated data request', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const updatedDataRequest: DataRequest = { ...mockDataRequest, reason: 'Updated reason' };
      const stub = sinon.stub(DataRequestService.prototype, 'updateDataRequest').resolves(updatedDataRequest);

      const requestHandler = updateDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequest.data_request_id;
      mockReq.body = { reason: 'Updated reason' };

      await requestHandler(mockReq, mockRes, mockNext);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, { reason: 'Updated reason' });
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(updatedDataRequest);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(DataRequestService.prototype, 'updateDataRequest').rejects(new Error('Data request not found'));

      const requestHandler = updateDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = 'non-existent-id';
      mockReq.body = { reason: 'Updated reason' };

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Data request not found');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });

  describe('deleteDataRequest', () => {
    it('throws error if DB connection fails to open', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(mockDBConnection, 'open').rejects(new Error('DB open failed'));

      const requestHandler = deleteDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequest.data_request_id;

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('DB open failed');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });

    it('returns 200 via sendStatus after deleting data request', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const stub = sinon.stub(DataRequestService.prototype, 'deleteDataRequest').resolves();

      const requestHandler = deleteDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = mockDataRequest.data_request_id;

      await requestHandler(mockReq, mockRes, mockNext);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.sendStatus).to.have.been.calledWith(200);
    });

    it('rolls back and rethrows if service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      sinon.stub(DataRequestService.prototype, 'deleteDataRequest').rejects(new Error('Data request not found'));

      const requestHandler = deleteDataRequest();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params.dataRequestId = 'non-existent-id';

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as ApiError).message).to.equal('Data request not found');
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});

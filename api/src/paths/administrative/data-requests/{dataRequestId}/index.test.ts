import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDataRequest } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { ApiNotFoundError } from '../../../../errors/api-error';
import { DataRequestListItem } from '../../../../models/data-request';
import { DataRequestService } from '../../../../services/data-request-service';

chai.use(sinonChai);

describe('administrative/data-requests/{dataRequestId}', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequest: DataRequestListItem = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    status: 'requested',
    create_date: '2026-01-02',
    requested_by: 1,
    requested_by_name: 'Test User',
    ticket_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    policy_id: 'f5f6a7b8-c9d0-1234-efab-345678901234'
  };

  describe('GET/getDataRequest', () => {
    it('returns the data request', async () => {
      const mockDBConnection = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const getStub = sinon.stub(DataRequestService.prototype, 'getDataRequestListItem').resolves(mockDataRequest);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { dataRequestId: mockDataRequest.data_request_id };

      await getDataRequest()(mockReq, mockRes, mockNext);

      expect(getStub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(mockDataRequest);
    });

    it('rolls back and rethrows when the data request does not exist', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon
        .stub(DataRequestService.prototype, 'getDataRequestListItem')
        .rejects(new ApiNotFoundError('Data request not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { dataRequestId: mockDataRequest.data_request_id };

      try {
        await getDataRequest()(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Data request not found');
        expect(mockDBConnection.commit).not.to.have.been.called;
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});

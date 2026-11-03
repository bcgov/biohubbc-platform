import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDataRequests } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { DataRequestListItem } from '../../../models/data-request';
import { DataRequestService } from '../../../services/data-request-service';
import { makePaginationOptionsFromRequest } from '../../../utils/pagination';

chai.use(sinonChai);

describe('administrative/data-requests', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequests: DataRequestListItem[] = [
    {
      data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      reason: 'Research purposes',
      status: 'requested',
      create_date: '2026-01-02',
      requested_by: 1,
      requested_by_name: 'Test User',
      ticket_id: 'd4e5f6a7-b8c9-0123-def0-234567890123',
      policy_id: 'f5f6a7b8-c9d0-1234-efab-345678901234'
    }
  ];

  describe('GET/getDataRequests', () => {
    it('returns one page of data requests with the total', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const getListStub = sinon
        .stub(DataRequestService.prototype, 'getDataRequestList')
        .resolves({ data_requests: mockDataRequests, total: 12 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { search: 'research', page: '2', limit: '5' };

      const expectedPagination = makePaginationOptionsFromRequest(mockReq);

      await getDataRequests()(mockReq, mockRes, mockNext);

      expect(getListStub).to.have.been.calledOnceWith({ keyword: 'research' }, expectedPagination);
      expect(mockDBConnection.commit).to.have.been.calledOnce;
      expect(mockDBConnection.release).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.data_requests).to.eql(mockDataRequests);
      expect(mockRes.jsonValue.pagination.total).to.equal(12);
    });

    it('lists every data request when no search is given', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

      const getListStub = sinon
        .stub(DataRequestService.prototype, 'getDataRequestList')
        .resolves({ data_requests: [], total: 0 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {};

      await getDataRequests()(mockReq, mockRes, mockNext);

      expect(getListStub.firstCall.args[0]).to.eql({ keyword: undefined });
      expect(mockRes.jsonValue.data_requests).to.eql([]);
      expect(mockRes.jsonValue.pagination.total).to.equal(0);
    });

    it('rolls back and rethrows if the service throws', async () => {
      const mockDBConnection = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(DataRequestService.prototype, 'getDataRequestList').rejects(new Error('Service error'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await getDataRequests()(mockReq, mockRes, mockNext);
        expect.fail('Expected handler to throw');
      } catch (error) {
        expect((error as Error).message).to.equal('Service error');
        expect(mockDBConnection.commit).not.to.have.been.called;
        expect(mockDBConnection.rollback).to.have.been.calledOnce;
        expect(mockDBConnection.release).to.have.been.calledOnce;
      }
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestStatus,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { DataRequestRepository } from '../repositories/data-request-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { DataRequestService } from './data-request-service';

chai.use(sinonChai);

describe('DataRequestService', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequest: DataRequest = {
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    reason: 'Research purposes',
    team_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    requested_by: 1,
    record_end_date: null,
    create_date: '2025-01-01T00:00:00.000Z',
    create_user: 1,
    update_date: null,
    update_user: null,
    revision_count: 0
  };

  const mockDataRequestStatus: DataRequestStatus = {
    data_request_status_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    data_request_id: mockDataRequest.data_request_id,
    comment_id: null,
    request_status: 'REQUESTED',
    record_end_date: null,
    create_date: '2025-01-01T00:00:00.000Z',
    create_user: 1,
    update_date: null,
    update_user: null,
    revision_count: 0
  };

  const mockDataRequestWithStatus: DataRequestWithStatus = {
    ...mockDataRequest,
    data_request_status: mockDataRequestStatus
  };

  describe('findDataRequestById', () => {
    it('should return a data request for a given dataRequestId', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(mockDataRequest);

      const result = await service.findDataRequestById(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(result).to.deep.equal(mockDataRequest);
    });

    it('should return null when data request is not found', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').resolves(null as unknown as DataRequest);

      const result = await service.findDataRequestById('non-existent-id');

      expect(result).to.be.null;
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequestById').rejects(new Error('DB error'));

      try {
        await service.findDataRequestById(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('getDataRequestById', () => {
    it('should return a data request', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const stub = sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').resolves(mockDataRequest);

      const result = await service.getDataRequestById(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
      expect(result).to.deep.equal(mockDataRequest);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'getDataRequestById').rejects(new Error('DB error'));

      try {
        await service.getDataRequestById(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('findDataRequests', () => {
    it('should return data requests when no filters provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests();

      expect(stub).to.have.been.calledOnceWith(undefined);
      expect(result).to.deep.equal(mockRequests);
    });

    it('should return filtered data requests when filters provided', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const filters = {
        date_from: '2025-01-01',
        date_to: '2025-01-31',
        requested_by: 1,
        team_id: mockDataRequest.team_id
      };
      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests(filters);

      expect(stub).to.have.been.calledOnceWith(filters);
      expect(result).to.deep.equal(mockRequests);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'findDataRequests').rejects(new Error('DB error'));

      try {
        await service.findDataRequests();
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('findDataRequests with status filter', () => {
    it('should pass status in filters to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const filters = { status: 'REQUESTED' as const };
      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests(filters);

      expect(stub).to.have.been.calledOnceWith(filters);
      expect(result).to.deep.equal(mockRequests);
    });

    it('should pass filters including status to repository', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const filters = { status: 'APPROVED' as const, team_id: mockDataRequest.team_id };
      const mockRequests = [mockDataRequest];
      const stub = sinon.stub(DataRequestRepository.prototype, 'findDataRequests').resolves(mockRequests);

      const result = await service.findDataRequests(filters);

      expect(stub).to.have.been.calledOnceWith(filters);
      expect(result).to.deep.equal(mockRequests);
    });
  });

  describe('createDataRequest', () => {
    it('should create a new data request and return it with status', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'New research project' };
      const stub = sinon.stub(DataRequestRepository.prototype, 'createDataRequest').resolves(mockDataRequestWithStatus);

      const result = await service.createDataRequest(mockDataRequest.team_id, mockDataRequest.requested_by, payload);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.team_id, mockDataRequest.requested_by, payload);
      expect(result).to.deep.equal(mockDataRequestWithStatus);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'Test' };
      sinon.stub(DataRequestRepository.prototype, 'createDataRequest').rejects(new Error('DB error'));

      try {
        await service.createDataRequest('team-id', 1, payload);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('updateDataRequest', () => {
    it('should update a data request successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: UpdateDataRequest = { reason: 'Updated reason' };
      const updatedRequest: DataRequest = { ...mockDataRequest, reason: 'Updated reason' };
      const stub = sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').resolves(updatedRequest);

      const result = await service.updateDataRequest(mockDataRequest.data_request_id, payload);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id, payload);
      expect(result).to.deep.equal(updatedRequest);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const payload: UpdateDataRequest = { reason: 'Updated' };
      sinon.stub(DataRequestRepository.prototype, 'updateDataRequest').rejects(new Error('DB error'));

      try {
        await service.updateDataRequest(mockDataRequest.data_request_id, payload);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });

  describe('deleteDataRequest', () => {
    it('should delete a data request successfully', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      const stub = sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').resolves();

      await service.deleteDataRequest(mockDataRequest.data_request_id);

      expect(stub).to.have.been.calledOnceWith(mockDataRequest.data_request_id);
    });

    it('should propagate repository errors', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DataRequestService(mockDBConnection);

      sinon.stub(DataRequestRepository.prototype, 'deleteDataRequest').rejects(new Error('DB error'));

      try {
        await service.deleteDataRequest(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err: any) {
        expect(err.message).to.equal('DB error');
      }
    });
  });
});

import chai, { expect } from 'chai';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  CreateDataRequest,
  DataRequest,
  DataRequestStatus,
  DataRequestWithStatus,
  UpdateDataRequest
} from '../models/data-request';
import { getMockDBConnection } from '../__mocks__/db';
import { DataRequestRepository } from './data-request-repository';

chai.use(sinonChai);

describe('DataRequestRepository', () => {
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

  describe('findDataRequests', () => {
    it('should return data requests when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequests();

      expect(result).to.eql([mockDataRequest]);
    });

    it('should return empty array when no data requests found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequests();

      expect(result).to.eql([]);
    });
  });

  describe('getDataRequestById', () => {
    it('should return a data request when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.getDataRequestById(mockDataRequest.data_request_id);

      expect(result).to.eql(mockDataRequest);
    });

    it('should throw error when data request is not found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      try {
        await repo.getDataRequestById(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to get data request');
      }
    });
  });

  describe('findDataRequestById', () => {
    it('should return a data request when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequestById(mockDataRequest.data_request_id);

      expect(result).to.eql(mockDataRequest);
    });

    it('should return null if data request does not exist', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequestById(mockDataRequest.data_request_id);

      expect(result).to.be.null;
    });
  });

  describe('findDataRequestsByStatus', () => {
    it('should return mapped data requests with status when found', async () => {
      const rawRow = {
        data_request_id: mockDataRequest.data_request_id,
        reason: mockDataRequest.reason,
        team_id: mockDataRequest.team_id,
        requested_by: mockDataRequest.requested_by,
        record_end_date: mockDataRequest.record_end_date,
        create_date: mockDataRequest.create_date,
        create_user: mockDataRequest.create_user,
        update_date: mockDataRequest.update_date,
        update_user: mockDataRequest.update_user,
        revision_count: mockDataRequest.revision_count,
        data_request_status_id: mockDataRequestStatus.data_request_status_id,
        drs_data_request_id: mockDataRequestStatus.data_request_id,
        drs_comment_id: mockDataRequestStatus.comment_id,
        drs_request_status: mockDataRequestStatus.request_status,
        drs_record_end_date: mockDataRequestStatus.record_end_date,
        drs_create_date: mockDataRequestStatus.create_date,
        drs_create_user: mockDataRequestStatus.create_user,
        drs_update_date: mockDataRequestStatus.update_date,
        drs_update_user: mockDataRequestStatus.update_user,
        drs_revision_count: mockDataRequestStatus.revision_count
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [rawRow]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequestsByStatus({ status: 'REQUESTED' });

      expect(result).to.eql([mockDataRequestWithStatus]);
    });

    it('should return empty array when no data requests found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequestsByStatus({ status: 'APPROVED' });

      expect(result).to.eql([]);
    });
  });

  describe('createDataRequest', () => {
    it('should create and return a new data request with status', async () => {
      let knexCallCount = 0;
      const mockKnex = async () => {
        if (knexCallCount++ === 0) {
          return { rowCount: 1, rows: [mockDataRequest] } as unknown as QueryResult<any>;
        }
        return { rowCount: 1, rows: [mockDataRequestStatus] } as unknown as QueryResult<any>;
      };

      const mockDBConnection = getMockDBConnection({ knex: mockKnex });

      const repo = new DataRequestRepository(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'New research project' };

      const result = await repo.createDataRequest(mockDataRequest.team_id, mockDataRequest.requested_by, payload);

      expect(result).to.eql(mockDataRequestWithStatus);
    });

    it('should throw error when rowCount !== 1 on data request insert', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'Test' };

      try {
        await repo.createDataRequest(mockDataRequest.team_id, mockDataRequest.requested_by, payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to create data request');
      }
    });
  });

  describe('updateDataRequest', () => {
    it('should update and return the data request', async () => {
      const updatedRequest: DataRequest = { ...mockDataRequest, reason: 'Updated reason' };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [updatedRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const payload: UpdateDataRequest = { reason: 'Updated reason' };

      const result = await repo.updateDataRequest(mockDataRequest.data_request_id, payload);

      expect(result).to.eql(updatedRequest);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const payload: UpdateDataRequest = { reason: 'Updated' };

      try {
        await repo.updateDataRequest(mockDataRequest.data_request_id, payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to update data request');
      }
    });
  });

  describe('deleteDataRequest', () => {
    it('should soft delete a data request successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      await repo.deleteDataRequest(mockDataRequest.data_request_id);

      expect(true).to.be.true;
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      try {
        await repo.deleteDataRequest(mockDataRequest.data_request_id);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to delete data request');
      }
    });
  });
});

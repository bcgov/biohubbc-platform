import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DataRequestStatus, DataRequestStatusEnum, UpdateDataRequestStatus } from '../models/data-request-status';
import { getMockDBConnection } from '../__mocks__/db';
import { DataRequestStatusRepository } from './data-request-status-repository';

chai.use(sinonChai);

describe('DataRequestStatusRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  const mockDataRequestStatus: DataRequestStatus = {
    data_request_status_id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    data_request_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    comment_id: null,
    request_status: 'REQUESTED'
  };

  describe('getDataRequestStatusById', () => {
    it('should return a data request status when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequestStatus]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      const result = await repo.getDataRequestStatusById(mockDataRequestStatus.data_request_status_id);

      expect(result).to.eql(mockDataRequestStatus);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      try {
        await repo.getDataRequestStatusById(mockDataRequestStatus.data_request_status_id);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to get data request status');
      }
    });
  });

  describe('getDataRequestStatusByDataRequestId', () => {
    it('should return a data request status when found', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequestStatus]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      const result = await repo.getDataRequestStatusByDataRequestId(mockDataRequestStatus.data_request_id);

      expect(result).to.eql(mockDataRequestStatus);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      try {
        await repo.getDataRequestStatusByDataRequestId(mockDataRequestStatus.data_request_id);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to get data request status');
      }
    });
  });

  describe('createDataRequestStatus', () => {
    it('should create and return a new data request status', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequestStatus]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      const result = await repo.createDataRequestStatus(
        mockDataRequestStatus.data_request_id,
        DataRequestStatusEnum.enum.REQUESTED,
        null
      );

      expect(result).to.eql(mockDataRequestStatus);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      try {
        await repo.createDataRequestStatus(
          mockDataRequestStatus.data_request_id,
          DataRequestStatusEnum.enum.REQUESTED,
          null
        );
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to create data request status');
      }
    });
  });

  describe('updateDataRequestStatus', () => {
    it('should update and return the data request status', async () => {
      const updatedStatus: DataRequestStatus = { ...mockDataRequestStatus, request_status: 'APPROVED' };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [updatedStatus]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      const payload: UpdateDataRequestStatus = { request_status: DataRequestStatusEnum.enum.APPROVED };

      const result = await repo.updateDataRequestStatus(mockDataRequestStatus.data_request_status_id, payload);

      expect(result).to.eql(updatedStatus);
    });

    it('should throw error when rowCount !== 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestStatusRepository(mockDBConnection);

      const payload: UpdateDataRequestStatus = { request_status: DataRequestStatusEnum.enum.APPROVED };

      try {
        await repo.updateDataRequestStatus(mockDataRequestStatus.data_request_status_id, payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to update data request status');
      }
    });
  });
});

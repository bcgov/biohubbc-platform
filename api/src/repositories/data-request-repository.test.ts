import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { CreateDataRequest, DataRequest, UpdateDataRequest } from '../models/data-request';
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
    requested_by: 1
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

    it('should return data requests when filtering by status', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequests({ status: 'REQUESTED' });

      expect(result).to.eql([mockDataRequest]);
    });

    it('should return data requests when filtering by multiple filters', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const result = await repo.findDataRequests({
        team_id: mockDataRequest.team_id,
        requested_by: mockDataRequest.requested_by
      });

      expect(result).to.eql([mockDataRequest]);
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

  describe('createDataRequest', () => {
    it('should create and return a new data request', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockDataRequest]
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const payload: CreateDataRequest = { reason: 'New research project' };

      const result = await repo.createDataRequest(mockDataRequest.requested_by, payload);

      expect(result).to.eql(mockDataRequest);
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
        await repo.createDataRequest(mockDataRequest.requested_by, payload);
        throw new Error('Expected to throw');
      } catch (err) {
        expect((err as Error).message).to.equal('Failed to create data request');
      }
    });
  });

  describe('updateDataRequest', () => {
    it('should update the data request and return void', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: []
      } as unknown as QueryResult<any>;

      const mockDBConnection = getMockDBConnection({
        knex: async () => mockQueryResponse
      });

      const repo = new DataRequestRepository(mockDBConnection);

      const payload: UpdateDataRequest = { reason: 'Updated reason' };

      const result = await repo.updateDataRequest(mockDataRequest.data_request_id, payload);

      expect(result).to.be.undefined;
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

      const result = await repo.deleteDataRequest(mockDataRequest.data_request_id);

      expect(result).to.be.undefined;
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

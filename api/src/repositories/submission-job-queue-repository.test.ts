import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionJobQueueRepository } from './submission-job-queue-repository';

chai.use(sinonChai);

describe('SubmissionJobQueueRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertJobQueueRecord', () => {
    it('should return inserted job queue ID', async () => {
      const queueId = 1;

      const mockQueryResponse = { rowCount: 1, rows: [{ submission_job_queue_id: queueId }] } as any as Promise<
        QueryResult<any>
      >;
      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const repo = new SubmissionJobQueueRepository(mockDBConnection);
      const id = await repo.insertJobQueueRecord(queueId, 1, '');
      expect(id.queue_id).to.be.eql(queueId);
    });

    it('should throw error if SQL fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      try {
        await repo.insertJobQueueRecord(1, 1, '');
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to insert Queue Job');
      }
    });
  });

  describe('getNextQueueId', () => {
    it('should return queue Id', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ nextval: 2 }] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const id = await repo.getNextQueueId();
      expect(id.queueId).to.be.eql(2);
    });

    it('should throw error if sql fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      try {
        await repo.getNextQueueId();
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to fetch nextval from submission sequence');
      }
    });
  });

  describe('getNextUnprocessedJobQueueRecords', () => {
    it('should return all matching rows with no optional parameters', async () => {
      const mockQueryResponse = {
        rowCount: 3,
        rows: [{ submission_job_queue_id: 1 }, { submission_job_queue_id: 2 }, { submission_job_queue_id: 3 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const result = await repo.getNextUnprocessedJobQueueRecords();

      expect(result).to.be.eql([
        { submission_job_queue_id: 1 },
        { submission_job_queue_id: 2 },
        { submission_job_queue_id: 3 }
      ]);
    });

    it('should return all matching rows with all optional parameters', async () => {
      const mockQueryResponse = {
        rowCount: 3,
        rows: [{ submission_job_queue_id: 1 }, { submission_job_queue_id: 2 }, { submission_job_queue_id: 3 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const concurrency = 2;
      const attempts = 2;

      const result = await repo.getNextUnprocessedJobQueueRecords(concurrency, attempts);

      expect(result).to.be.eql([
        { submission_job_queue_id: 1 },
        { submission_job_queue_id: 2 },
        { submission_job_queue_id: 3 }
      ]);
    });
  });

  describe('startQueueRecord', () => {
    it('should run and return nothing', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_job_queue_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      const result = await repo.startQueueRecord(jobQueueId);

      expect(result).to.be.undefined;
    });

    it('should throw an error if rowCount is not 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      try {
        await repo.startQueueRecord(jobQueueId);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to start queue record');
      }
    });
  });

  describe('resetJobQueueRecord', () => {
    it('should run and return nothing', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_job_queue_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      const result = await repo.resetJobQueueRecord(jobQueueId);

      expect(result).to.be.undefined;
    });

    it('should throw an error if rowCount is not 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      try {
        await repo.resetJobQueueRecord(jobQueueId);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to reset queue record');
      }
    });
  });

  describe('endJobQueueRecord', () => {
    it('should run and return nothing', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_job_queue_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      const result = await repo.endJobQueueRecord(jobQueueId);

      expect(result).to.be.undefined;
    });

    it('should throw an error if rowCount is not 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      try {
        await repo.endJobQueueRecord(jobQueueId);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to end queue record');
      }
    });
  });

  describe('incrementAttemptCount', () => {
    it('should run and return nothing', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ submission_job_queue_id: 1 }]
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      const result = await repo.incrementAttemptCount(jobQueueId);

      expect(result).to.be.undefined;
    });

    it('should throw an error if rowCount is not 1', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const jobQueueId = 1;

      try {
        await repo.incrementAttemptCount(jobQueueId);
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to increment queue record attempts');
      }
    });
  });
});

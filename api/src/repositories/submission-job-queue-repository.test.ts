import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiGeneralError } from '../errors/api-error';
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

  describe('getSourceTransformIdForUserId', () => {
    it('should return with transform id', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ source_transform_id: 3 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });
      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      const transformId = await repo.getSourceTransformIdForUserId(1);
      expect(transformId).to.be.eql(3);
    });

    it('should throw an error when no transforms are found', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repo = new SubmissionJobQueueRepository(mockDBConnection);

      try {
        await repo.getSourceTransformIdForUserId(1);
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('Failed to get source transform Id');
      }
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import { QuarantineRecord, QuarantineStatusEnum } from '../../models/quarantine';
import { SubmissionRecordWithQuarantine } from '../../models/submission';
import { getMockDBConnection } from '../../__mocks__/db';
import { QuarantineRepository } from './quarantine-repository';

chai.use(sinonChai);

describe('QuarantineRepository', () => {
  describe('getQuarantineRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      const quarantineId = 'some-id';

      try {
        await repo.getQuarantineRecord(quarantineId);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get quarantine record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: QuarantineRecord = {
        quarantine_id: 'uuid-1',
        uri: 'test-uri',
        status: QuarantineStatusEnum.PENDING,
        upload_id: 'upload-uuid'
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      const result = await repo.getQuarantineRecord('uuid-1');

      expect(result).to.eql(mockRow);
    });
  });

  describe('insertQuarantineRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      try {
        await repo.insertQuarantineRecord({ uri: 'uri', status: QuarantineStatusEnum.PENDING });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert quarantine record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { quarantine_id: 'uuid-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      const result = await repo.insertQuarantineRecord({ uri: 'uri', status: QuarantineStatusEnum.PENDING });

      expect(result).to.eql(mockRow);
    });
  });

  describe('updateQuarantineRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      try {
        await repo.updateQuarantineRecord('uuid-1', { status: QuarantineStatusEnum.CLEAN });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update quarantine record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { quarantine_id: 'uuid-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      const result = await repo.updateQuarantineRecord('uuid-1', { status: QuarantineStatusEnum.CLEAN });

      expect(result).to.eql(mockRow);
    });
  });

  describe('getQuarantineRecordsWithScans', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns an array of submission records with quarantine', async () => {
      const mockRows: SubmissionRecordWithQuarantine[] = [
        {
          submission_id: 1,
          name: 'Test Submission',
          description: 'Test description',
          submitted_timestamp: new Date().toISOString(),
          quarantine: {
            quarantine_id: 'q-1',
            uri: 'http://example.com/file',
            status: 'pending',
            upload_id: 'u-1'
          } as QuarantineRecord
        }
      ];
      const mockResponse = { rowCount: 1, rows: mockRows } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repo = new QuarantineRepository(mockDBConnection);

      const result = await repo.getQuarantineRecordsWithScans();

      expect(result).to.eql(mockRows);
    });
  });
});

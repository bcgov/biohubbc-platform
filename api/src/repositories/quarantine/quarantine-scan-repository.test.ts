import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  IInsertQuarantineScan,
  IUpdateQuarantineScan,
  QuarantineScanRecord,
  ScanStatusEnum
} from '../../models/quarantine-scan';
import { getMockDBConnection } from '../../__mocks__/db';
import { QuarantineScanRepository } from './quarantine-scan-repository';

chai.use(sinonChai);

describe('QuarantineScanRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getQuarantineScanRecord', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineScanRepository(mockDBConnection);

      try {
        await repo.getQuarantineScanRecord('nonexistent-id');
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get quarantine scan record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: QuarantineScanRecord = {
        quarantine_scan_id: '11111111-1111-1111-1111-111111111111',
        quarantine_id: '22222222-2222-2222-2222-222222222222',
        scan_status: ScanStatusEnum.PENDING,
        scanned_at: null,
        scanner_version: null,
        results: null
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineScanRepository(mockDBConnection);

      const result = await repo.getQuarantineScanRecord(mockRow.quarantine_scan_id);
      expect(result).to.eql(mockRow);
    });
  });

  describe('insertQuarantineScanRecord', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineScanRepository(mockDBConnection);

      const input: IInsertQuarantineScan = {
        quarantine_id: '22222222-2222-2222-2222-222222222222',
        scan_status: ScanStatusEnum.PENDING,
        scanned_at: '2025-11-04T12:00:00Z'
      };

      try {
        await repo.insertQuarantineScanRecord(input);
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert quarantine scan record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { quarantine_scan_id: '33333333-3333-3333-3333-333333333333' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineScanRepository(mockDBConnection);

      const input: IInsertQuarantineScan = {
        quarantine_id: '22222222-2222-2222-2222-222222222222',
        scan_status: ScanStatusEnum.PENDING,
        scanned_at: '2025-11-04T12:00:00Z'
      };

      const result = await repo.insertQuarantineScanRecord(input);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateQuarantineScanRecord', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineScanRepository(mockDBConnection);

      const update: IUpdateQuarantineScan = {
        scan_status: ScanStatusEnum.ERROR
      };

      try {
        await repo.updateQuarantineScanRecord('33333333-3333-3333-3333-333333333333', update);
        expect.fail('Expected error was not thrown');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update quarantine scan record');
      }
    });

    it('returns the updated record ID if successful', async () => {
      const mockRow = { quarantine_scan_id: '33333333-3333-3333-3333-333333333333' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new QuarantineScanRepository(mockDBConnection);

      const update: IUpdateQuarantineScan = {
        scan_status: ScanStatusEnum.COMPLETED
      };

      const result = await repo.updateQuarantineScanRecord(mockRow.quarantine_scan_id, update);
      expect(result).to.eql(mockRow);
    });
  });
});

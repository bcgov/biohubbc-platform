import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  FileScanResultEnum,
  IInsertQuarantineScanFile,
  IUpdateQuarantineScanFile,
  QuarantineScanFileRecord
} from '../../models/quarantine-scan-file';
import { getMockDBConnection } from '../../__mocks__/db';
import { QuarantineScanFileRepository } from './quarantine-scan-file-repository';

chai.use(sinonChai);

describe('QuarantineScanFileRepository', () => {
  describe('getQuarantineScanFileRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if no record is found', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      try {
        await repository.getQuarantineScanFileRecord('some-id');
        expect.fail('Expected method to throw an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get quarantine scan file record');
      }
    });

    it('should return a record if found', async () => {
      const mockRow: QuarantineScanFileRecord = {
        quarantine_scan_file_id: 'uuid-1234',
        quarantine_scan_id: 'uuid-5678',
        file_path: '/path/to/file',
        scan_result: FileScanResultEnum.CLEAN
      };

      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const result = await repository.getQuarantineScanFileRecord('uuid-1234');

      expect(result).to.eql(mockRow);
    });
  });

  describe('insertQuarantineScanFileRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if insert fails', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const newFile: IInsertQuarantineScanFile = {
        quarantine_scan_id: 'uuid-5678',
        file_path: '/file/path',
        scan_result: FileScanResultEnum.PENDING
      };

      try {
        await repository.insertQuarantineScanFileRecord(newFile);
        expect.fail('Expected method to throw an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert quarantine scan file record');
      }
    });

    it('should return inserted record id on success', async () => {
      const mockRow = { quarantine_scan_file_id: 'uuid-1234' };
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const newFile: IInsertQuarantineScanFile = {
        quarantine_scan_id: 'uuid-5678',
        file_path: '/file/path',
        scan_result: FileScanResultEnum.PENDING
      };

      const result = await repository.insertQuarantineScanFileRecord(newFile);

      expect(result).to.eql(mockRow);
    });
  });

  describe('insertQuarantineScanFileRecordBatch', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if row count does not match input', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [{ quarantine_scan_file_id: 'uuid-1' }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const files: IInsertQuarantineScanFile[] = [
        { quarantine_scan_id: 'uuid-1', file_path: '/file1', scan_result: FileScanResultEnum.CLEAN },
        { quarantine_scan_id: 'uuid-2', file_path: '/file2', scan_result: FileScanResultEnum.INFECTED }
      ];

      try {
        await repository.insertQuarantineScanFileRecordBatch(files);
        expect.fail('Expected method to throw an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert quarantine scan file records');
      }
    });

    it('should return all inserted ids on success', async () => {
      const mockRows = [{ quarantine_scan_file_id: 'uuid-1' }, { quarantine_scan_file_id: 'uuid-2' }];
      const mockQueryResponse = {
        rowCount: 2,
        rows: mockRows
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const files: IInsertQuarantineScanFile[] = [
        { quarantine_scan_id: 'uuid-1', file_path: '/file1', scan_result: FileScanResultEnum.CLEAN },
        { quarantine_scan_id: 'uuid-2', file_path: '/file2', scan_result: FileScanResultEnum.INFECTED }
      ];

      const result = await repository.insertQuarantineScanFileRecordBatch(files);

      expect(result).to.eql(mockRows);
    });
  });

  describe('updateQuarantineScanFileRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if update fails', async () => {
      const mockQueryResponse = {
        rowCount: 0,
        rows: []
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const updateData: IUpdateQuarantineScanFile = { scan_result: FileScanResultEnum.CLEAN };

      try {
        await repository.updateQuarantineScanFileRecord('uuid-1234', updateData);
        expect.fail('Expected method to throw an error');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update quarantine scan file record');
      }
    });

    it('should return updated record id on success', async () => {
      const mockRow = { quarantine_scan_file_id: 'uuid-1234' };
      const mockQueryResponse = {
        rowCount: 1,
        rows: [mockRow]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const repository = new QuarantineScanFileRepository(mockDBConnection);

      const updateData: IUpdateQuarantineScanFile = { scan_result: FileScanResultEnum.CLEAN };

      const result = await repository.updateQuarantineScanFileRecord('uuid-1234', updateData);

      expect(result).to.eql(mockRow);
    });
  });
});

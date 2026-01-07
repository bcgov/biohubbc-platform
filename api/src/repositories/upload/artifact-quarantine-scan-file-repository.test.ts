import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactQuarantineScanFile,
  CreateArtifactQuarantineScanFile,
  SecurityStatusEnum,
  UpdateArtifactQuarantineScanFile
} from '../../models/artifact-quarantine-scan-file';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactQuarantineScanFileRepository } from './artifact-quarantine-scan-file-repository';

chai.use(sinonChai);

describe('ArtifactQuarantineScanFileRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactQuarantineScanFile', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      try {
        await repo.getArtifactQuarantineScanFile('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal(
          'Failed to get upload artifact quarantine scan file record'
        );
      }
    });

    it('returns a record if found', async () => {
      const mockRow: ArtifactQuarantineScanFile = {
        artifact_quarantine_scan_file_id: 'id-1',
        artifact_quarantine_scan_id: 'scan-id-1',
        file_path: 'path/to/file',
        security: SecurityStatusEnum.CLEAN
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const result = await repo.getArtifactQuarantineScanFile('id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('insertArtifactQuarantineScanFile', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const payload: CreateArtifactQuarantineScanFile = {
        artifact_quarantine_scan_id: 'scan-id-1',
        file_path: 'path/to/file',
        security: SecurityStatusEnum.CLEAN
      };

      try {
        await repo.insertArtifactQuarantineScanFile(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal(
          'Failed to insert upload artifact quarantine scan file record'
        );
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { artifact_quarantine_scan_file_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const payload: CreateArtifactQuarantineScanFile = {
        artifact_quarantine_scan_id: 'scan-id-1',
        file_path: 'path/to/file',
        security: SecurityStatusEnum.CLEAN
      };

      const result = await repo.insertArtifactQuarantineScanFile(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('insertArtifactQuarantineScanFileBatch', () => {
    it('throws an error if row count does not match', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const payload: CreateArtifactQuarantineScanFile[] = [
        { artifact_quarantine_scan_id: 'scan-id-1', file_path: 'file1', security: SecurityStatusEnum.CLEAN },
        { artifact_quarantine_scan_id: 'scan-id-2', file_path: 'file2', security: SecurityStatusEnum.INFECTED }
      ];

      try {
        await repo.insertArtifactQuarantineScanFileBatch(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('returns inserted record IDs if successful', async () => {
      const mockRows = [{ artifact_quarantine_scan_file_id: 'id-1' }, { artifact_quarantine_scan_file_id: 'id-2' }];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const payload: CreateArtifactQuarantineScanFile[] = [
        { artifact_quarantine_scan_id: 'scan-id-1', file_path: 'file1', security: SecurityStatusEnum.CLEAN },
        { artifact_quarantine_scan_id: 'scan-id-2', file_path: 'file2', security: SecurityStatusEnum.INFECTED }
      ];

      const result = await repo.insertArtifactQuarantineScanFileBatch(payload);
      expect(result).to.eql(mockRows);
    });
  });

  describe('updateArtifactQuarantineScanFile', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const payload: UpdateArtifactQuarantineScanFile = { security: SecurityStatusEnum.INFECTED };

      try {
        await repo.updateArtifactQuarantineScanFile('id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('returns updated record ID if successful', async () => {
      const mockRow = { artifact_quarantine_scan_file_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanFileRepository(mockDBConnection);

      const payload: UpdateArtifactQuarantineScanFile = { security: SecurityStatusEnum.INFECTED };

      const result = await repo.updateArtifactQuarantineScanFile('id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactSecurityScanFile,
  CreateArtifactSecurityScanFile,
  UpdateArtifactSecurityScanFile
} from '../../models/artifact-security-scan-file';
import { SecurityStatusEnum } from '../../models/security-status';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityScanFileRepository } from './artifact-security-scan-file-repository';

chai.use(sinonChai);

describe('ArtifactSecurityScanFileRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurityScanFile', () => {
    it('throws an error if no matching record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      try {
        await repo.getArtifactSecurityScanFile('id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal(
          'Failed to get upload artifact security scan file record'
        );
      }
    });

    it('returns a record if found', async () => {
      const mockRow: ArtifactSecurityScanFile = {
        artifact_security_scan_file_id: 'id-1',
        artifact_security_scan_id: 'scan-id-1',
        file_path: 'path/to/file',
        security: SecurityStatusEnum.CLEAN
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const result = await repo.getArtifactSecurityScanFile('id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('insertArtifactSecurityScanFile', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const payload: CreateArtifactSecurityScanFile = {
        artifact_security_scan_id: 'scan-id-1',
        file_path: 'path/to/file',
        security: SecurityStatusEnum.CLEAN
      };

      try {
        await repo.insertArtifactSecurityScanFile(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal(
          'Failed to insert upload artifact security scan file record'
        );
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { artifact_security_scan_file_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const payload: CreateArtifactSecurityScanFile = {
        artifact_security_scan_id: 'scan-id-1',
        file_path: 'path/to/file',
        security: SecurityStatusEnum.CLEAN
      };

      const result = await repo.insertArtifactSecurityScanFile(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('insertArtifactSecurityScanFileBatch', () => {
    it('throws an error if row count does not match', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const payload: CreateArtifactSecurityScanFile[] = [
        { artifact_security_scan_id: 'scan-id-1', file_path: 'file1', security: SecurityStatusEnum.CLEAN },
        { artifact_security_scan_id: 'scan-id-2', file_path: 'file2', security: SecurityStatusEnum.INFECTED }
      ];

      try {
        await repo.insertArtifactSecurityScanFileBatch(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('returns inserted record IDs if successful', async () => {
      const mockRows = [{ artifact_security_scan_file_id: 'id-1' }, { artifact_security_scan_file_id: 'id-2' }];
      const mockQueryResponse = { rowCount: 2, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const payload: CreateArtifactSecurityScanFile[] = [
        { artifact_security_scan_id: 'scan-id-1', file_path: 'file1', security: SecurityStatusEnum.CLEAN },
        { artifact_security_scan_id: 'scan-id-2', file_path: 'file2', security: SecurityStatusEnum.INFECTED }
      ];

      const result = await repo.insertArtifactSecurityScanFileBatch(payload);
      expect(result).to.eql(mockRows);
    });
  });

  describe('updateArtifactSecurityScanFile', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const payload: UpdateArtifactSecurityScanFile = { security: SecurityStatusEnum.INFECTED };

      try {
        await repo.updateArtifactSecurityScanFile('id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
      }
    });

    it('returns updated record ID if successful', async () => {
      const mockRow = { artifact_security_scan_file_id: 'id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanFileRepository(mockDBConnection);

      const payload: UpdateArtifactSecurityScanFile = { security: SecurityStatusEnum.INFECTED };

      const result = await repo.updateArtifactSecurityScanFile('id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactSecurityScan,
  CreateArtifactSecurityScan,
  UpdateArtifactSecurityScan
} from '../../models/artifact-security-scan';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityScanRepository } from './artifact-security-scan-repository';

chai.use(sinonChai);

describe('ArtifactSecurityScanRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurityScan', () => {
    it('throws an error if no record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      try {
        await repo.getArtifactSecurityScan('scan-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get security scan record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: ArtifactSecurityScan = {
        artifact_security_scan_id: 'scan-id-1',
        artifact_security_id: 'security-id-1',
        status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1.0',
        scanned_at: new Date().toISOString(),
        results: { issues: 0 }
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      const result = await repo.getArtifactSecurityScan('scan-id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getArtifactSecurityScans', () => {
    it('returns all records', async () => {
      const mockRows: ArtifactSecurityScan[] = [
        {
          artifact_security_scan_id: 'scan-id-1',
          artifact_security_id: 'security-id-1',
          status: ProcessStatusStatusEnum.PENDING,
          scanner_version: 'v1.0',
          scanned_at: new Date().toISOString(),
          results: { issues: 0 }
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      const result = await repo.getArtifactSecurityScans();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertArtifactSecurityScan', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      const payload: CreateArtifactSecurityScan = {
        artifact_security_id: 'security-id-1',
        status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1.0',
        scanned_at: new Date().toISOString(),
        results: { issues: 0 }
      };

      try {
        await repo.insertArtifactSecurityScan(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert security scan record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { artifact_security_scan_id: 'scan-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      const payload: CreateArtifactSecurityScan = {
        artifact_security_id: 'security-id-1',
        status: ProcessStatusStatusEnum.PENDING,
        scanner_version: 'v1.0',
        scanned_at: new Date().toISOString(),
        results: { issues: 0 }
      };

      const result = await repo.insertArtifactSecurityScan(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateArtifactSecurityScan', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      const payload: UpdateArtifactSecurityScan = { status: ProcessStatusStatusEnum.COMPLETED };

      try {
        await repo.updateArtifactSecurityScan('scan-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update security scan record');
      }
    });

    it('returns updated record ID if successful', async () => {
      const mockRow = { artifact_security_scan_id: 'scan-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactSecurityScanRepository(mockDBConnection);

      const payload: UpdateArtifactSecurityScan = { status: ProcessStatusStatusEnum.COMPLETED };

      const result = await repo.updateArtifactSecurityScan('scan-id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });
});

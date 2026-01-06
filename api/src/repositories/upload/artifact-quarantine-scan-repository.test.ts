import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError } from '../../errors/api-error';
import {
  ArtifactQuarantineScan,
  CreateArtifactQuarantineScan,
  UpdateArtifactQuarantineScan
} from '../../models/artifact-quarantine-scan';
import { ProcessStatusStatusEnum } from '../../models/process-status';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactQuarantineScanRepository } from './artifact-quarantine-scan-repository';

chai.use(sinonChai);

describe('ArtifactQuarantineScanRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactQuarantineScan', () => {
    it('throws an error if no record found', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      try {
        await repo.getArtifactQuarantineScan('scan-id-1');
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get quarantine scan record');
      }
    });

    it('returns a record if found', async () => {
      const mockRow: ArtifactQuarantineScan = {
        artifact_quarantine_scan_id: 'scan-id-1',
        artifact_quarantine_id: 'quarantine-id-1',
        status: 'pending',
        scanner_version: 'v1.0',
        scanned_at: new Date().toISOString(),
        results: { issues: 0 }
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      const result = await repo.getArtifactQuarantineScan('scan-id-1');
      expect(result).to.eql(mockRow);
    });
  });

  describe('getArtifactQuarantineScans', () => {
    it('returns all records', async () => {
      const mockRows: ArtifactQuarantineScan[] = [
        {
          artifact_quarantine_scan_id: 'scan-id-1',
          artifact_quarantine_id: 'quarantine-id-1',
          status: 'pending',
          scanner_version: 'v1.0',
          scanned_at: new Date().toISOString(),
          results: { issues: 0 }
        }
      ];
      const mockQueryResponse = { rowCount: 1, rows: mockRows } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      const result = await repo.getArtifactQuarantineScans();
      expect(result).to.eql(mockRows);
    });
  });

  describe('insertArtifactQuarantineScan', () => {
    it('throws an error if insert fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      const payload: CreateArtifactQuarantineScan = {
        artifact_quarantine_id: 'quarantine-id-1',
        status: 'pending',
        scanner_version: 'v1.0',
        scanned_at: new Date().toISOString(),
        results: { issues: 0 }
      };

      try {
        await repo.insertArtifactQuarantineScan(payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to insert quarantine scan record');
      }
    });

    it('returns the inserted record ID if successful', async () => {
      const mockRow = { artifact_quarantine_scan_id: 'scan-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      const payload: CreateArtifactQuarantineScan = {
        artifact_quarantine_id: 'quarantine-id-1',
        status: 'pending',
        scanner_version: 'v1.0',
        scanned_at: new Date().toISOString(),
        results: { issues: 0 }
      };

      const result = await repo.insertArtifactQuarantineScan(payload);
      expect(result).to.eql(mockRow);
    });
  });

  describe('updateArtifactQuarantineScan', () => {
    it('throws an error if update fails', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      const payload: UpdateArtifactQuarantineScan = { status: ProcessStatusStatusEnum.COMPLETED };

      try {
        await repo.updateArtifactQuarantineScan('scan-id-1', payload);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiExecuteSQLError);
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to update quarantine scan record');
      }
    });

    it('returns updated record ID if successful', async () => {
      const mockRow = { artifact_quarantine_scan_id: 'scan-id-1' };
      const mockQueryResponse = { rowCount: 1, rows: [mockRow] } as any as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });
      const repo = new ArtifactQuarantineScanRepository(mockDBConnection);

      const payload: UpdateArtifactQuarantineScan = { status: ProcessStatusStatusEnum.COMPLETED };

      const result = await repo.updateArtifactQuarantineScan('scan-id-1', payload);
      expect(result).to.eql(mockRow);
    });
  });
});

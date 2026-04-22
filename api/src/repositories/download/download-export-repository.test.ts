import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { CreateDownloadExportPayload } from '../../models/download-export';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from './download-export-repository';

chai.use(sinonChai);

const EXPORT_ID = 'dddd0000-0000-0000-0000-000000000001';
const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const ARTIFACT_ID = 'bbbb0000-0000-0000-0000-000000000001';

const mockExportRow = {
  download_export_id: EXPORT_ID,
  download_id: DOWNLOAD_ID,
  format: 'csv',
  status: 'pending',
  mode: 'per_feature_type',
  chunk_size_bytes: '524288000',
  started_at: null,
  completed_at: null,
  error_message: null
};

const validPayload: CreateDownloadExportPayload = {
  download_id: DOWNLOAD_ID,
  format: 'csv',
  mode: 'per_feature_type',
  chunk_size_bytes: '524288000'
};

describe('DownloadExportRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadExport', () => {
    it('INSERT values include download_id, csv format, per_feature_type mode, and chunk_size_bytes; returns full record', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockExportRow], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.createDownloadExport(validPayload);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_export');
      expect(sqlText).to.include('RETURNING');
      expect(sqlText).to.include('mode');
      expect(sqlText).to.include('chunk_size_bytes');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DOWNLOAD_ID);
      expect(sqlValues).to.include('csv');
      expect(sqlValues).to.include('per_feature_type');
      expect(sqlValues).to.include('524288000');

      expect(result).to.equal(mockExportRow);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);

      try {
        await repo.createDownloadExport(validPayload);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to insert download export record');
      }
    });
  });

  describe('findDownloadExportById', () => {
    it('returns null when no row is found', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.findDownloadExportById(EXPORT_ID);

      expect(result).to.be.null;
    });

    it('returns the record when found', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockExportRow], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.findDownloadExportById(EXPORT_ID);

      expect(result).to.equal(mockExportRow);
    });
  });

  describe('getDownloadExportById', () => {
    it('returns the record when found', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockExportRow], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.getDownloadExportById(EXPORT_ID);

      expect(result).to.equal(mockExportRow);
    });

    it('throws ApiExecuteSQLError when missing', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);

      try {
        await repo.getDownloadExportById(EXPORT_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Download export not found');
      }
    });
  });

  describe('listDownloadExportsByDownloadId', () => {
    it('SQL contains LEFT JOIN, COUNT for part_count, and ORDER BY create_date DESC', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.listDownloadExportsByDownloadId(DOWNLOAD_ID);

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('LEFT JOIN');
      expect(sqlText).to.include('COUNT');
      expect(sqlText).to.include('part_count');
      expect(sqlText).to.match(/ORDER BY[\s\S]*create_date[\s\S]*DESC/i);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DOWNLOAD_ID);
    });

    it('returns empty array when no exports exist', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.listDownloadExportsByDownloadId(DOWNLOAD_ID);

      expect(result).to.have.lengthOf(0);
    });
  });

  describe('updateDownloadExportStatus', () => {
    const processingPayloadRowCount = mockQueryResult([], 1);

    it('includes started_at in values on processing path', async () => {
      const sqlStub = sinon.stub().resolves(processingPayloadRowCount);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.updateDownloadExportStatus(EXPORT_ID, DownloadStatusEnum.PROCESSING, {
        started_at: '2026-04-22T00:00:00Z'
      });

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('2026-04-22T00:00:00Z');
      expect(sqlValues).to.include(DownloadStatusEnum.PROCESSING);
    });

    it('includes completed_at and error_message on FAILED path', async () => {
      const sqlStub = sinon.stub().resolves(processingPayloadRowCount);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.updateDownloadExportStatus(EXPORT_ID, DownloadStatusEnum.FAILED, {
        completed_at: '2026-04-22T01:00:00Z',
        error_message: 'Parquet read failed'
      });

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('2026-04-22T01:00:00Z');
      expect(sqlValues).to.include('Parquet read failed');
    });

    it('passes null timestamps when metadata is omitted (COALESCE keeps prior values)', async () => {
      const sqlStub = sinon.stub().resolves(processingPayloadRowCount);
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.updateDownloadExportStatus(EXPORT_ID, DownloadStatusEnum.READY);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.not.include('2026-04-22T00:00:00Z');
      // Three COALESCE slots (started_at, completed_at, error_message) all receive null.
      const nullCount = sqlValues.filter((v: unknown) => v === null).length;
      expect(nullCount).to.equal(3);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);

      try {
        await repo.updateDownloadExportStatus(EXPORT_ID, DownloadStatusEnum.READY);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to update download export status');
      }
    });
  });

  describe('createDownloadExportArtifact', () => {
    it('INSERT values include exportId, artifactId, and chunkId', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.createDownloadExportArtifact(EXPORT_ID, ARTIFACT_ID, 3);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(EXPORT_ID);
      expect(sqlValues).to.include(ARTIFACT_ID);
      expect(sqlValues).to.include(3);
    });

    it('SQL contains ON CONFLICT … DO NOTHING (retry-idempotent)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.createDownloadExportArtifact(EXPORT_ID, ARTIFACT_ID, 1);

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('ON CONFLICT');
      expect(sqlText).to.include('DO NOTHING');
    });

    it('does not throw when rowCount is 0 (conflict path)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      // Should resolve without throwing — ON CONFLICT DO NOTHING returns rowCount=0 on collision.
      await repo.createDownloadExportArtifact(EXPORT_ID, ARTIFACT_ID, 1);
    });
  });

  describe('listDownloadExportArtifactsByExportId', () => {
    it('SQL contains JOIN to artifact and ORDER BY chunk_id ASC', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      await repo.listDownloadExportArtifactsByExportId(EXPORT_ID);

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.match(/JOIN\s+artifact/i);
      expect(sqlText).to.match(/ORDER BY[\s\S]*chunk_id[\s\S]*ASC/i);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(EXPORT_ID);
    });

    it('returns empty array when export has no artifacts', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.listDownloadExportArtifactsByExportId(EXPORT_ID);

      expect(result).to.have.lengthOf(0);
    });
  });
});

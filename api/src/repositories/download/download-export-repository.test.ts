import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { DownloadExportRepository } from './download-export-repository';

chai.use(sinonChai);

describe('DownloadExportRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadExport', () => {
    it('inserts into download_export with downloadId and format, returns download_export_id', async () => {
      const mockExportId = 'dddd0000-0000-0000-0000-000000000001';
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ download_export_id: mockExportId }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.createDownloadExport('aaaa0000-0000-0000-0000-000000000001', 'parquet');

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_export');
      expect(sqlText).to.include('RETURNING download_export_id');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include('parquet');
      expect(result.download_export_id).to.equal(mockExportId);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);

      try {
        await repo.createDownloadExport('aaaa0000-0000-0000-0000-000000000001', 'parquet');
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to insert download export record');
      }
    });
  });

  describe('getDownloadExportsByDownloadId', () => {
    it('returns array of export records for a download', async () => {
      const mockRows = [
        {
          download_export_id: 'dddd0000-0000-0000-0000-000000000001',
          download_id: 'aaaa0000-0000-0000-0000-000000000001',
          format: 'parquet',
          status: 'pending',
          started_at: null,
          completed_at: null,
          error_message: null
        }
      ];
      const sqlStub = sinon.stub().resolves(mockQueryResult(mockRows));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.getDownloadExportsByDownloadId('aaaa0000-0000-0000-0000-000000000001');

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_export');
      expect(sqlText).to.include('download_id');
      expect(sqlText).to.include('status');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(result).to.have.lengthOf(1);
      expect(result[0].download_export_id).to.equal('dddd0000-0000-0000-0000-000000000001');
    });

    it('returns empty array when no exports exist', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadExportRepository(mockDBConnection);
      const result = await repo.getDownloadExportsByDownloadId('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.have.lengthOf(0);
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadExportDetail } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { HTTP403, HTTP404, HTTPError } from '../../../errors/http-error';
import { DownloadExportRecord } from '../../../models/download-export';
import { DownloadExportPart, DownloadExportService } from '../../../services/download/download-export-service';

chai.use(sinonChai);

const makeExportRecord = (overrides: Partial<DownloadExportRecord> = {}): DownloadExportRecord => ({
  download_export_id: 'bbbb0000-0000-0000-0000-000000000001',
  download_id: 'aaaa0000-0000-0000-0000-000000000001',
  format: 'csv',
  status: 'pending',
  max_part_size_bytes: '524288000',
  mode: 'per_feature_type',
  started_at: null,
  completed_at: null,
  error_message: null,
  ...overrides
});

describe('paths/download-export/{exportId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getDownloadExportDetail', () => {
    it('should return 200 with record and empty parts when status is pending', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord({ status: 'pending' });
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { exportId: exportRecord.download_export_id };

      await getDownloadExportDetail()(mockReq, mockRes, mockNext);

      expect(listPartsStub).to.not.have.been.called;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ ...exportRecord, parts: [] });
    });

    it('authorizes with a null systemUserId for an unauthenticated request', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const dbConnStub = sinon.stub(db.dbDependencies, 'getDBConnection');

      const exportRecord = makeExportRecord({ status: 'pending' });
      const authStub = sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      // No keycloak_token — unauthenticated request
      mockReq.keycloak_token = undefined as any;
      mockReq.params = { exportId: exportRecord.download_export_id };

      await getDownloadExportDetail()(mockReq, mockRes, mockNext);

      // Anonymous requests run on the shared API-user connection and pass a null identity so a
      // team-scoped parent still throws HTTP403 inside getAuthorizedExport.
      expect(dbConnStub).to.not.have.been.called;
      expect(authStub).to.have.been.calledOnceWith(exportRecord.download_export_id, null);
      expect(mockRes.statusValue).to.equal(200);
    });

    it('should return 200 with record and populated parts when status is ready', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord({
        status: 'ready',
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:05:00Z'
      });
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);

      const parts: DownloadExportPart[] = [
        { chunk_id: 0, file_size_bytes: '12345', url: 'https://s3.example.com/part_0.zip' },
        { chunk_id: 1, file_size_bytes: '67890', url: 'https://s3.example.com/part_1.zip' }
      ];
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls').resolves(parts);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { exportId: exportRecord.download_export_id };

      await getDownloadExportDetail()(mockReq, mockRes, mockNext);

      expect(listPartsStub).to.have.been.calledOnceWith(exportRecord.download_export_id, exportRecord.started_at);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ ...exportRecord, parts });
    });

    it('should return 200 with record and empty parts when status is processing', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord({ status: 'processing' });
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { exportId: exportRecord.download_export_id };

      await getDownloadExportDetail()(mockReq, mockRes, mockNext);

      expect(listPartsStub).to.not.have.been.called;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ ...exportRecord, parts: [] });
    });

    it('should return 200 with record and empty parts when status is failed', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord({
        status: 'failed',
        error_message: 'Something went wrong'
      });
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { exportId: exportRecord.download_export_id };

      await getDownloadExportDetail()(mockReq, mockRes, mockNext);

      expect(listPartsStub).to.not.have.been.called;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ ...exportRecord, parts: [] });
    });

    it('should propagate HTTP403 from getAuthorizedExport when user is not authorized', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').rejects(new HTTP403('Access denied'));
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { exportId: 'bbbb0000-0000-0000-0000-000000000001' };

      try {
        await getDownloadExportDetail()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }

      expect(listPartsStub).to.not.have.been.called;
    });

    it('should propagate HTTP404 from getAuthorizedExport when export is not found', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').rejects(new HTTP404('Export not found'));
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { exportId: 'bbbb0000-0000-0000-0000-000000000999' };

      try {
        await getDownloadExportDetail()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
        expect((error as HTTPError).status).to.equal(404);
        expect((error as HTTPError).message).to.equal('Export not found');
      }

      expect(listPartsStub).to.not.have.been.called;
    });
  });
});

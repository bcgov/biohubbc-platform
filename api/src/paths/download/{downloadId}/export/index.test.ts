import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDownloadExport, listDownloadExports } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP403, HTTP409, HTTPError } from '../../../../errors/http-error';
import { DownloadExportListRow, DownloadExportRecord } from '../../../../models/download-export';
import { publisherDependencies } from '../../../../queue/publisher';
import { DownloadExportService } from '../../../../services/download/download-export-service';
import { DownloadService } from '../../../../services/download/download-service';

chai.use(sinonChai);

const makeExportRecord = (overrides: Partial<DownloadExportRecord> = {}): DownloadExportRecord => ({
  download_export_id: 'bbbb0000-0000-0000-0000-000000000001',
  download_id: 'aaaa0000-0000-0000-0000-000000000001',
  format: 'csv',
  status: 'pending',
  chunk_size_bytes: '524288000',
  mode: 'per_feature_type',
  started_at: null,
  completed_at: null,
  error_message: null,
  ...overrides
});

const stubPgBossForTransactionalPublish = () => {
  const sendStub = sinon.stub().resolves('mock-job-id');
  const createQueueStub = sinon.stub().resolves();
  const mockBoss = { send: sendStub, createQueue: createQueueStub };
  sinon.stub(publisherDependencies, 'getPgBoss').returns(mockBoss as any);
  return { sendStub, createQueueStub };
};

describe('paths/download/{downloadId}/export/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadExport (POST)', () => {
    it('should return 200 with the created export record', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      stubPgBossForTransactionalPublish();

      const exportRecord = makeExportRecord();
      const createStub = sinon.stub(DownloadExportService.prototype, 'createDownloadExport').resolves(exportRecord);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: exportRecord.download_id };
      mockReq.body = {};

      await createDownloadExport()(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith(exportRecord.download_id, 42, {
        chunk_size_bytes: undefined
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(exportRecord);
    });

    it('should forward chunk_size_bytes from body to service as a string', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      stubPgBossForTransactionalPublish();

      const exportRecord = makeExportRecord({ chunk_size_bytes: '10485760' });
      const createStub = sinon.stub(DownloadExportService.prototype, 'createDownloadExport').resolves(exportRecord);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: exportRecord.download_id };
      mockReq.body = { chunk_size_bytes: 10485760 };

      await createDownloadExport()(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith(exportRecord.download_id, 42, {
        chunk_size_bytes: '10485760'
      });
      expect(mockRes.statusValue).to.equal(200);
    });

    it('should omit chunk_size_bytes when body is empty', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      stubPgBossForTransactionalPublish();

      const exportRecord = makeExportRecord();
      const createStub = sinon.stub(DownloadExportService.prototype, 'createDownloadExport').resolves(exportRecord);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: exportRecord.download_id };
      mockReq.body = {};

      await createDownloadExport()(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith(exportRecord.download_id, 42, {
        chunk_size_bytes: undefined
      });
    });

    it('should propagate HTTP409 from service when download is not ready', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon
        .stub(DownloadExportService.prototype, 'createDownloadExport')
        .rejects(new HTTP409('Download is not ready — cannot export'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };
      mockReq.body = {};

      try {
        await createDownloadExport()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTPError).status).to.equal(409);
        expect((error as HTTPError).message).to.equal('Download is not ready — cannot export');
      }
    });
  });

  describe('listDownloadExports (GET)', () => {
    it('should return 200 with the array from the service after authorizing the parent download', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const downloadId = 'aaaa0000-0000-0000-0000-000000000001';
      const authStub = sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves({
        download_id: downloadId,
        download_status: 'ready',
        format: 'csv',
        metadata: null,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null,
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: '12000',
        fragment_size_bytes: '209715200',
        create_date: '2025-01-01T00:00:00Z'
      } as any);

      const rows: DownloadExportListRow[] = [
        { ...makeExportRecord({ download_export_id: 'bbbb0000-0000-0000-0000-000000000001' }), part_count: 2 },
        { ...makeExportRecord({ download_export_id: 'bbbb0000-0000-0000-0000-000000000002' }), part_count: 0 }
      ];
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportsByDownloadId').resolves(rows);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId };

      await listDownloadExports()(mockReq, mockRes, mockNext);

      expect(authStub).to.have.been.calledOnceWith(downloadId, 42);
      expect(listStub).to.have.been.calledOnceWith(downloadId);
      expect(authStub).to.have.been.calledBefore(listStub);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(rows);
    });

    it('should propagate HTTP403 from getAuthorizedDownload', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));
      const listStub = sinon.stub(DownloadExportService.prototype, 'listExportsByDownloadId');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      try {
        await listDownloadExports()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }

      expect(listStub).to.not.have.been.called;
    });
  });
});

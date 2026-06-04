import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadVersionExportDetail } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { createMockDownloadVersionExport } from '../../../../../__mocks__/download';
import * as db from '../../../../../database/db';
import { HTTP403, HTTPError } from '../../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../../models/download-status';
import { DownloadVersionExportRecord } from '../../../../../models/download-version-export';
import { DownloadExportPart, DownloadExportService } from '../../../../../services/download/download-export-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const EXPORT_ID = 'eeee0000-0000-0000-0000-000000000001';

const makeExportRecord = (overrides: Partial<DownloadVersionExportRecord> = {}): DownloadVersionExportRecord => ({
  ...createMockDownloadVersionExport({ download_version_export_id: EXPORT_ID }),
  download_id: DOWNLOAD_ID,
  status: DownloadStatusEnum.PENDING,
  started_at: null,
  completed_at: null,
  error_message: null,
  ...overrides
});

describe('paths/download/{downloadId}/export/{downloadVersionExportId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getDownloadVersionExportDetail', () => {
    it('threads both path params into getAuthorizedExport, and returns populated parts when status is ready', async () => {
      // Verifies: both path params (downloadId, downloadVersionExportId) are read from req.params and
      // passed to getAuthorizedExport; a READY export populates `parts` via listExportPartUrls.

      // Step 1: Stub the DB connection, auth-export (ready), and the parts listing
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord({
        status: DownloadStatusEnum.READY,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:05:00.000Z'
      });
      const authStub = sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);

      const parts: DownloadExportPart[] = [
        { chunk_id: 1, file_size_bytes: '12345', url: 'https://s3.example.com/part-1.zip' },
        { chunk_id: 2, file_size_bytes: '67890', url: 'https://s3.example.com/part-2.zip' }
      ];
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls').resolves(parts);

      // Step 2: Send the request with both path params
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionExportId: EXPORT_ID };

      await getDownloadVersionExportDetail()(mockReq, mockRes, mockNext);

      // Step 3: Verify auth got (downloadId, exportId, systemUserId) and parts were listed by export id
      expect(authStub).to.have.been.calledOnceWith(DOWNLOAD_ID, EXPORT_ID, 42);
      expect(listPartsStub).to.have.been.calledOnceWith(EXPORT_ID, exportRecord.started_at);

      // Step 4: Verify the response carries the populated parts
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ ...exportRecord, parts });
    });

    it('returns empty parts and does not list part URLs when status is not ready', async () => {
      // Verifies: a non-ready export (pending) skips listExportPartUrls and returns parts: [].

      // Step 1: Stub the DB connection and a pending auth-export
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord({ status: DownloadStatusEnum.PENDING });
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').resolves(exportRecord);
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      // Step 2: Send the request
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionExportId: EXPORT_ID };

      await getDownloadVersionExportDetail()(mockReq, mockRes, mockNext);

      // Step 3: Verify no part-URL work and an empty parts array
      expect(listPartsStub).to.not.have.been.called;
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ ...exportRecord, parts: [] });
    });

    it('propagates HTTP403 from getAuthorizedExport without listing parts', async () => {
      // Verifies: an auth failure short-circuits — parts are never listed.

      // Step 1: Stub the DB connection and reject from auth-export
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExport').rejects(new HTTP403('Access denied'));
      const listPartsStub = sinon.stub(DownloadExportService.prototype, 'listExportPartUrls');

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionExportId: EXPORT_ID };

      try {
        await getDownloadVersionExportDetail()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 403 propagated
        expect(error).to.be.instanceOf(HTTP403);
        expect((error as HTTPError).status).to.equal(403);
      }

      // Step 4: Verify parts were never listed
      expect(listPartsStub).to.not.have.been.called;
    });
  });
});

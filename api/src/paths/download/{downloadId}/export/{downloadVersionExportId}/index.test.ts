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
    it('threads both path params and the system user into getAuthorizedExportWithParts and returns its result', async () => {
      // Verifies: both path params (downloadId, downloadVersionExportId) and the system user are read
      // from the request and passed to the service; the service result is returned verbatim. The
      // status→parts gating itself is unit-tested on the service, not here.

      // Step 1: Stub the DB connection and the single service call
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const parts: DownloadExportPart[] = [
        { chunk_id: 1, file_size_bytes: '12345', url: 'https://s3.example.com/part-1.zip' },
        { chunk_id: 2, file_size_bytes: '67890', url: 'https://s3.example.com/part-2.zip' }
      ];
      const result = {
        ...makeExportRecord({
          status: DownloadStatusEnum.READY,
          started_at: '2026-01-01T00:00:00.000Z',
          completed_at: '2026-01-01T00:05:00.000Z'
        }),
        parts
      };
      const detailStub = sinon.stub(DownloadExportService.prototype, 'getAuthorizedExportWithParts').resolves(result);

      // Step 2: Send the request with both path params
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID, downloadVersionExportId: EXPORT_ID };

      await getDownloadVersionExportDetail()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got (downloadId, exportId, systemUserId) and its result was returned
      expect(detailStub).to.have.been.calledOnceWith(DOWNLOAD_ID, EXPORT_ID, 42);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(result);
    });

    it('propagates HTTP403 from getAuthorizedExportWithParts', async () => {
      // Verifies: an auth failure in the service propagates out of the handler.

      // Step 1: Stub the DB connection and reject from the service
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadExportService.prototype, 'getAuthorizedExportWithParts').rejects(new HTTP403('Access denied'));

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
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { listDownloadVersionExports } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { createMockDownloadVersionExport } from '../../../../__mocks__/download';
import * as db from '../../../../database/db';
import { HTTP403 } from '../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../models/download-status';
import { DownloadVersionExportListRow, DownloadVersionExportRecord } from '../../../../models/download-version-export';
import { DownloadExportService } from '../../../../services/download/download-export-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';

const makeExportRecord = (overrides: Partial<DownloadVersionExportRecord> = {}): DownloadVersionExportRecord => ({
  ...createMockDownloadVersionExport(),
  download_id: DOWNLOAD_ID,
  status: DownloadStatusEnum.PENDING,
  started_at: null,
  completed_at: null,
  error_message: null,
  ...overrides
});

describe('paths/download/{downloadId}/export/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('listDownloadVersionExports (GET)', () => {
    it('returns 200 with the paginated export list from the service', async () => {
      // Verifies: GET delegates to the service list/count calls and returns the paginated rows.

      // Step 1: Stub the DB connection and list/count methods
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const rows: DownloadVersionExportListRow[] = [
        { ...makeExportRecord(), part_count: 2 },
        {
          ...makeExportRecord({ download_version_export_id: 'eeee0000-0000-0000-0000-000000000002' }),
          part_count: 0
        }
      ];
      const listStub = sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExports').resolves(rows);
      const countStub = sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExportsCount').resolves(2);

      // Step 2: Send the request
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.query = { page: '1', limit: '10' };

      await listDownloadVersionExports()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got the downloadId and pagination
      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID, {
        page: 1,
        limit: 10,
        sort: undefined,
        order: undefined
      });
      expect(countStub).to.have.been.calledOnceWith(DOWNLOAD_ID);

      // Step 4: Verify the response
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        exports: rows,
        pagination: {
          total: 2,
          per_page: 10,
          current_page: 1,
          last_page: 1,
          sort: undefined,
          order: undefined
        }
      });
    });

    it('uses the API user connection when no bearer token is present', async () => {
      const dbConnectionObj = getMockDBConnection();
      const getAPIUserDBConnectionStub = sinon
        .stub(db.dbDependencies, 'getAPIUserDBConnection')
        .returns(dbConnectionObj);

      sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExports').resolves([]);
      sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExportsCount').resolves(0);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { downloadId: DOWNLOAD_ID };

      await listDownloadVersionExports()(mockReq, mockRes, mockNext);

      expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
    });

    it('propagates HTTP403 from the service', async () => {
      // Verifies: service failures surface unchanged through the route.

      // Step 1: Stub the DB connection and reject from the list method
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExports').rejects(new HTTP403('Access denied'));
      sinon.stub(DownloadExportService.prototype, 'listDownloadVersionExportsCount').resolves(0);

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      try {
        await listDownloadVersionExports()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 403 propagated
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });
});

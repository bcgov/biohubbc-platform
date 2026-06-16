import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDownloadVersionExport, listDownloadVersionExports } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { createMockDownloadVersionExport } from '../../../../__mocks__/download';
import * as db from '../../../../database/db';
import { HTTP403, HTTP404, HTTP409, HTTPError } from '../../../../errors/http-error';
import { DownloadStatusEnum } from '../../../../models/download-status';
import { DownloadVersionExportListRow, DownloadVersionExportRecord } from '../../../../models/download-version-export';
import { DownloadExportService } from '../../../../services/download/download-export-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';

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

  describe('createDownloadVersionExport (POST)', () => {
    it('opens the connection, calls the service with the route connection, commits, and returns 200 with the record', async () => {
      // Verifies: the POST threads (downloadId, systemUserId, request, connection) into the service —
      // including the SAME route connection used for the transaction — and returns the record.

      // Step 1: Stub the DB connection and the service create method
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const exportRecord = makeExportRecord();
      const createStub = sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .resolves(exportRecord);

      // Step 2: Send the request with the version target and no max_part_size_bytes
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.body = { download_version_id: VERSION_ID };

      await createDownloadVersionExport()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got the four args — the request object carries the version id, the
      // route connection is the 4th
      expect(createStub).to.have.been.calledOnceWith(
        DOWNLOAD_ID,
        42,
        { download_version_id: VERSION_ID, max_part_size_bytes: undefined },
        dbConnectionObj
      );

      // Step 4: Verify the response
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(exportRecord);
    });

    it('widens a numeric body max_part_size_bytes to a string before calling the service', async () => {
      // Verifies: the route's number → string widening for the service request payload.

      // Step 1: Stub the DB connection and the service
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      const createStub = sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .resolves(makeExportRecord({ max_part_size_bytes: '10485760' }));

      // Step 2: Send the request with the version target and a numeric max_part_size_bytes
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.body = { download_version_id: VERSION_ID, max_part_size_bytes: 10485760 };

      await createDownloadVersionExport()(mockReq, mockRes, mockNext);

      // Step 3: Verify the request object carries the version id and the widened string
      expect(createStub.firstCall.args[2]).to.deep.equal({
        download_version_id: VERSION_ID,
        max_part_size_bytes: '10485760'
      });
    });

    it('does not publish at the route layer — the service owns enqueueing', async () => {
      // Verifies: the route is thin — it never calls any publish*; the service decides whether to
      // enqueue on the route connection.

      // Step 1: Stub the DB connection and spy the publish dependency
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      const publishStub = sinon.stub(DownloadExportService.dependencies, 'publishProcessDownloadVersionExportJob');
      sinon.stub(DownloadExportService.prototype, 'createDownloadVersionExport').resolves(makeExportRecord());

      // Step 2: Send the request
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.body = { download_version_id: VERSION_ID };

      await createDownloadVersionExport()(mockReq, mockRes, mockNext);

      // Step 3: Verify the route never published (publish lives behind the stubbed service)
      expect(publishStub).to.not.have.been.called;
    });

    it('propagates HTTP409 from the service when the download is not ready', async () => {
      // Verifies: a 409 from the service surfaces unchanged through the route.

      // Step 1: Stub the DB connection and reject from the service
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .rejects(new HTTP409('Download version is not ready — cannot export'));

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.body = { download_version_id: VERSION_ID };

      try {
        await createDownloadVersionExport()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 409 propagated
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTPError).status).to.equal(409);
      }
    });

    it('propagates HTTP404 from the service when the version does not belong to the download', async () => {
      // Verifies: a 404 from the service (version owned by a different download / not found) surfaces
      // unchanged through the route.

      // Step 1: Stub the DB connection and reject from the service with a 404
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadExportService.prototype, 'createDownloadVersionExport')
        .rejects(new HTTP404('Download version not found'));

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.body = { download_version_id: VERSION_ID };

      try {
        await createDownloadVersionExport()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 404 propagated
        expect(error).to.be.instanceOf(HTTP404);
        expect((error as HTTPError).status).to.equal(404);
      }
    });
  });

  describe('listDownloadVersionExports (GET)', () => {
    it('returns 200 with the authorized list from the service', async () => {
      // Verifies: GET delegates to the service's authorized list (threading downloadId + system user)
      // and returns the rows. The auth-before-list ordering is the service's contract, covered there.

      // Step 1: Stub the DB connection and the authorized-list method
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const rows: DownloadVersionExportListRow[] = [
        { ...makeExportRecord(), part_count: 2 },
        {
          ...makeExportRecord({ download_version_export_id: 'eeee0000-0000-0000-0000-000000000002' }),
          part_count: 0
        }
      ];
      const listStub = sinon.stub(DownloadExportService.prototype, 'listAuthorizedExportsByDownloadId').resolves(rows);

      // Step 2: Send the request
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      await listDownloadVersionExports()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got the downloadId and the system user
      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID, 42);

      // Step 4: Verify the response
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(rows);
    });

    it('propagates HTTP403 from the service', async () => {
      // Verifies: an auth failure inside the service surfaces unchanged through the route.

      // Step 1: Stub the DB connection and reject from the authorized-list method
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadExportService.prototype, 'listAuthorizedExportsByDownloadId')
        .rejects(new HTTP403('Access denied'));

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

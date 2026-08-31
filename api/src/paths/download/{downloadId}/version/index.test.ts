import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { listDownloadVersions } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { createMockDownloadVersionStatusRecord } from '../../../../__mocks__/download';
import * as db from '../../../../database/db';
import { HTTP403 } from '../../../../errors/http-error';
import { DownloadService } from '../../../../services/download/download-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';

describe('paths/download/{downloadId}/version/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('listDownloadVersions (GET)', () => {
    it('returns 200 with the paginated version list from the service', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const rows = [createMockDownloadVersionStatusRecord({ download_id: DOWNLOAD_ID })];
      const listStub = sinon.stub(DownloadService.prototype, 'listDownloadVersions').resolves(rows);
      const countStub = sinon.stub(DownloadService.prototype, 'listDownloadVersionsCount').resolves(1);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };
      mockReq.query = { page: '1', limit: '10' };

      await listDownloadVersions()(mockReq, mockRes, mockNext);

      expect(listStub).to.have.been.calledOnceWith(DOWNLOAD_ID, {
        page: 1,
        limit: 10,
        sort: undefined,
        order: undefined
      });
      expect(countStub).to.have.been.calledOnceWith(DOWNLOAD_ID);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        versions: rows,
        pagination: {
          total: 1,
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

      sinon.stub(DownloadService.prototype, 'listDownloadVersions').resolves([]);
      sinon.stub(DownloadService.prototype, 'listDownloadVersionsCount').resolves(0);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { downloadId: DOWNLOAD_ID };

      await listDownloadVersions()(mockReq, mockRes, mockNext);

      expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
      expect(mockRes.statusValue).to.equal(200);
    });

    it('propagates HTTP403 from the service', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'listDownloadVersions').rejects(new HTTP403('Access denied'));
      sinon.stub(DownloadService.prototype, 'listDownloadVersionsCount').resolves(0);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      try {
        await listDownloadVersions()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP403);
      }
    });
  });
});

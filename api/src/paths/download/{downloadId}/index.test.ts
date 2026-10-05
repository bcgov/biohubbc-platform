import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { claimDownloadForCurrentUser, findDownloadById } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { HTTP404, HTTP409, HTTPError } from '../../../errors/http-error';
import { DownloadDetailRecord } from '../../../models/download';
import { DownloadService } from '../../../services/download/download-service';

chai.use(sinonChai);

const makeDownloadRecord = (overrides: Partial<DownloadDetailRecord> = {}): DownloadDetailRecord => ({
  download_id: 'aaaa0000-0000-0000-0000-000000000001',
  download_status: 'ready',
  format: 'parquet',
  metadata: null,
  started_at: '2025-01-01T00:00:00Z',
  completed_at: '2025-01-01T00:01:00Z',
  downloaded_at: null,
  create_date: '2025-01-01T00:00:00Z',
  download_version_id: 'dddd0000-0000-0000-0000-000000000001',
  name: 'Test download',
  description: 'Test description',
  ...overrides
});

describe('paths/download/{downloadId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findDownloadById', () => {
    it('should return 200 with authorized download details', async () => {
      const mockDownload = makeDownloadRecord();
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(mockDownload);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { downloadId: mockDownload.download_id };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        download_version_id: 'dddd0000-0000-0000-0000-000000000001',
        status: 'ready',
        name: 'Test download',
        description: 'Test description',
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      });

      // The handler surfaces the version id resolved from the authorized download record
      expect(mockRes.jsonValue.download_version_id).to.equal(mockDownload.download_version_id);
    });

    it('should return 200 with description: null when policy description is null', async () => {
      const mockDownload = makeDownloadRecord({ description: null });
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(mockDownload);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { downloadId: mockDownload.download_id };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.include({
        name: 'Test download',
        description: null
      });
    });

    it('uses the authenticated connection when a bearer token is present', async () => {
      const mockDownload = makeDownloadRecord();
      const dbConnectionObj = getMockDBConnection();
      const getDBConnectionStub = sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(mockDownload);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: mockDownload.download_id };

      await findDownloadById()(mockReq, mockRes, mockNext);

      expect(getDBConnectionStub).to.have.been.calledOnceWith('token');
      expect(mockRes.statusValue).to.equal(200);
    });

    it('should throw HTTP404 when the download is not found during response loading', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'findDownloadById').resolves(null);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      try {
        await findDownloadById()(mockReq, mockRes, mockNext);
        expect.fail('Expected HTTP404');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
      }
    });
  });

  describe('claimDownloadForCurrentUser', () => {
    it('should return 200 when claim succeeds', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      const claimStub = sinon.stub(DownloadService.prototype, 'claimDownload').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = claimDownloadForCurrentUser();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.sendStatusValue).to.equal(200);
      expect(claimStub).to.have.been.calledOnceWith('aaaa0000-0000-0000-0000-000000000001', 42);
    });

    it('should propagate HTTP409 from service when already claimed', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'claimDownload').rejects(new HTTP409('Download already claimed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = claimDownloadForCurrentUser();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTPError).message).to.equal('Download already claimed');
      }
    });

    it('should propagate HTTP404 from service when download not found', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'claimDownload').rejects(new HTTP404('Download not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'nonexistent-uuid' };

      const requestHandler = claimDownloadForCurrentUser();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP404);
        expect((error as HTTPError).message).to.equal('Download not found');
      }
    });
  });
});

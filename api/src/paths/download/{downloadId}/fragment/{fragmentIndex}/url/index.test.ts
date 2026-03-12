import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getFragmentUrl } from '.';
import * as db from '../../../../../../database/db';
import { HTTP403, HTTP404, HTTPError } from '../../../../../../errors/http-error';
import { DownloadService } from '../../../../../../services/download/download-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../../__mocks__/db';

chai.use(sinonChai);

describe('paths/download/{downloadId}/fragment/{fragmentIndex}/url/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getFragmentUrl', () => {
    it('should return 200 with signed URL when download is ready and user is authorized', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 5 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: 'bbbb0000-0000-0000-0000-000000000001',
        data_request_id: null,
        download_status: 'ready'
      };

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadService.prototype, 'getFragmentSignedUrl').resolves('https://s3.example.com/signed-url');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = {} as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ url: 'https://s3.example.com/signed-url' });
    });

    it('should return 200 for anonymous download without authentication', async () => {
      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: null,
        data_request_id: null,
        download_status: 'ready'
      };

      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadService.prototype, 'getFragmentSignedUrl').resolves('https://s3.example.com/signed-url');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('should return 200 for owned download fragment when user is authorized', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 5 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: 1,
        team_id: null,
        data_request_id: null,
        download_status: 'ready'
      };

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadService.prototype, 'getFragmentSignedUrl').resolves('https://s3.example.com/signed-url');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = {} as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ url: 'https://s3.example.com/signed-url' });
    });

    it('should throw HTTP403 when unauthenticated user accesses owned download fragment', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should throw HTTP404 when download not found', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 5 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP404('Download not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = {} as any;
      mockReq.params = { downloadId: '999', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(404);
        expect((error as HTTPError).message).to.equal('Download not found');
      }
    });

    it('should throw HTTP403 when authenticated user is not authorized for the download', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 5 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = {} as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should throw HTTP403 when unauthenticated user tries to access non-anonymous download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should throw HTTP409 when download is not ready', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 5 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: 'bbbb0000-0000-0000-0000-000000000001',
        data_request_id: null,
        download_status: 'processing'
      };

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = {} as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001', fragmentIndex: '0' };

      const requestHandler = getFragmentUrl();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(409);
        expect((error as HTTPError).message).to.equal('Download is not ready');
      }
    });
  });
});

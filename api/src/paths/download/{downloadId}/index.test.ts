import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { claimDownloadForCurrentUser, findDownloadById } from '.';
import * as db from '../../../database/db';
import { ApiConflictError } from '../../../errors/api-error';
import { HTTP403, HTTP404, HTTPError } from '../../../errors/http-error';
import { DownloadPipelineService } from '../../../services/download/download-pipeline-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';

chai.use(sinonChai);

describe('paths/download/{downloadId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findDownloadById', () => {
    it('should return 200 with download details and fragments when user is authorized', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: 'bbbb0000-0000-0000-0000-000000000001',
        data_request_id: null,
        download_status: 'ready',
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      };

      const mockFragments = [
        {
          fragment_index: 0,
          fragment_status: 'ready',
          file_name: 'biohub-aaaa0000-0000-0000-0000-000000000001.zip',
          file_size_bytes: 12345,
          estimated_size_bytes: 12000,
          feature_count: 3,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          error_message: null
        }
      ];

      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        status: 'ready',
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null,
        fragments: [
          {
            fragment_index: 0,
            status: 'ready',
            file_name: 'biohub-aaaa0000-0000-0000-0000-000000000001.zip',
            file_size_bytes: 12345,
            estimated_size_bytes: 12000,
            feature_count: 3,
            started_at: '2025-01-01T00:00:00Z',
            completed_at: '2025-01-01T00:01:00Z',
            error_message: null
          }
        ],
        instructions: null
      });
    });

    it('should return 200 for anonymous download without authentication', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: null,
        data_request_id: null,
        download_status: 'ready',
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      };

      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsByDownloadId').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      // No keycloak_token — unauthenticated request
      mockReq.keycloak_token = undefined as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('should return 200 for owned download when user is authorized', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: 1,
        team_id: null,
        data_request_id: null,
        download_status: 'ready',
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      };

      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsByDownloadId').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('should throw HTTP403 when unauthenticated user accesses owned download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should throw HTTP403 when wrong user accesses owned download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should throw HTTP404 when download not found', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').rejects(new HTTP404('Download not found'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.params = { downloadId: '999' };

      const requestHandler = findDownloadById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(404);
        expect((error as HTTPError).message).to.equal('Download not found');
      }
    });

    it('should throw HTTP403 when unauthenticated user accesses team download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });

    it('should include signed URLs and instructions for anonymous ready download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: null,
        data_request_id: null,
        download_status: 'ready',
        total_fragments: 2,
        completed_fragments: 2,
        estimated_total_size_bytes: 24000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      };

      const mockFragments = [
        {
          fragment_index: 0,
          fragment_status: 'ready',
          file_name: 'fragment_0.zip',
          file_size_bytes: 12000,
          estimated_size_bytes: 12000,
          feature_count: 3,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          error_message: null
        },
        {
          fragment_index: 1,
          fragment_status: 'ready',
          file_name: 'fragment_1.zip',
          file_size_bytes: 12000,
          estimated_size_bytes: 12000,
          feature_count: 2,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          error_message: null
        }
      ];

      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);
      sinon
        .stub(DownloadPipelineService.prototype, 'getFragmentSignedUrl')
        .onFirstCall()
        .resolves('https://s3.example.com/fragment_0.zip')
        .onSecondCall()
        .resolves('https://s3.example.com/fragment_1.zip');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue.fragments[0].url).to.equal('https://s3.example.com/fragment_0.zip');
      expect(mockRes.jsonValue.fragments[1].url).to.equal('https://s3.example.com/fragment_1.zip');
      expect(mockRes.jsonValue.instructions).to.include('Your download is ready');
      expect(mockRes.jsonValue.instructions).to.include('curl');
    });

    it('should not include URLs for authenticated ready download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: 1,
        team_id: null,
        data_request_id: null,
        download_status: 'ready',
        total_fragments: 1,
        completed_fragments: 1,
        estimated_total_size_bytes: 12000,
        started_at: '2025-01-01T00:00:00Z',
        completed_at: '2025-01-01T00:01:00Z',
        downloaded_at: null
      };

      const mockFragments = [
        {
          fragment_index: 0,
          fragment_status: 'ready',
          file_name: 'fragment_0.zip',
          file_size_bytes: 12000,
          estimated_size_bytes: 12000,
          feature_count: 3,
          started_at: '2025-01-01T00:00:00Z',
          completed_at: '2025-01-01T00:01:00Z',
          error_message: null
        }
      ];

      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);
      const getFragmentSignedUrlStub = sinon.stub(DownloadPipelineService.prototype, 'getFragmentSignedUrl');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(getFragmentSignedUrlStub).to.not.have.been.called;
      expect(mockRes.jsonValue.fragments[0]).to.not.have.property('url');
      expect(mockRes.jsonValue.instructions).to.equal(null);
    });

    it('should not include URLs for anonymous pending download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const mockDownload = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        system_user_id: null,
        team_id: null,
        data_request_id: null,
        download_status: 'pending',
        total_fragments: 1,
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null
      };

      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').resolves(mockDownload as any);
      sinon.stub(DownloadPipelineService.prototype, 'getFragmentsByDownloadId').resolves([]);
      const getFragmentSignedUrlStub = sinon.stub(DownloadPipelineService.prototype, 'getFragmentSignedUrl');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(getFragmentSignedUrlStub).to.not.have.been.called;
      expect(mockRes.jsonValue.instructions).to.equal(null);
    });

    it('should throw HTTP403 when authenticated user is not authorized for the download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadPipelineService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(403);
        expect((error as HTTPError).message).to.equal('Access denied');
      }
    });
  });

  describe('claimDownloadForCurrentUser', () => {
    it('should return 200 when claiming anonymous download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadPipelineService.prototype, 'claimDownload').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = claimDownloadForCurrentUser();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.sendStatusValue).to.equal(200);
    });

    it('should throw 409 when claiming non-anonymous download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadPipelineService.prototype, 'claimDownload')
        .rejects(new ApiConflictError('Unable to claim download', ['Download is not anonymous or does not exist']));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = claimDownloadForCurrentUser();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }
    });
  });
});

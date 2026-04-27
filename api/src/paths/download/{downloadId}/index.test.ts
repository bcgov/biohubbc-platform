import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { claimDownloadForCurrentUser, findDownloadById } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as db from '../../../database/db';
import { HTTP403, HTTP404, HTTP409, HTTPError } from '../../../errors/http-error';
import { DownloadRecord } from '../../../models/download';
import { DownloadService } from '../../../services/download/download-service';

chai.use(sinonChai);

const makeDownloadRecord = (overrides: Partial<DownloadRecord> = {}): DownloadRecord => ({
  download_id: 'aaaa0000-0000-0000-0000-000000000001',
  download_status: 'ready',
  format: 'parquet',
  metadata: null,
  started_at: '2025-01-01T00:00:00Z',
  completed_at: '2025-01-01T00:01:00Z',
  downloaded_at: null,
  total_fragments: 1,
  completed_fragments: 1,
  estimated_total_size_bytes: '12000',
  fragment_size_bytes: '209715200',
  create_date: '2025-01-01T00:00:00Z',
  ...overrides
});

describe('paths/download/{downloadId}/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findDownloadById', () => {
    it('should return 200 with download details and fragments when user is authorized', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = makeDownloadRecord();

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

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);

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
        estimated_total_size_bytes: '12000',
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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const mockDownload = makeDownloadRecord();

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves([]);

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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = makeDownloadRecord();

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: 'aaaa0000-0000-0000-0000-000000000001' };

      const requestHandler = findDownloadById();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });

    it('should throw HTTP403 when unauthenticated user accesses owned download', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP404('Download not found'));

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const mockDownload = makeDownloadRecord({
        total_fragments: 2,
        completed_fragments: 2,
        estimated_total_size_bytes: '24000'
      });

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

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);
      sinon
        .stub(DownloadService.prototype, 'getFragmentSignedUrl')
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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const mockDownload = makeDownloadRecord();

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

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves(mockFragments as any);
      const getFragmentSignedUrlStub = sinon.stub(DownloadService.prototype, 'getFragmentSignedUrl');

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const mockDownload = makeDownloadRecord({
        download_status: 'pending',
        completed_fragments: 0,
        estimated_total_size_bytes: null,
        started_at: null,
        completed_at: null
      });

      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').resolves(mockDownload);
      sinon.stub(DownloadService.prototype, 'getFragmentsByDownloadId').resolves([]);
      const getFragmentSignedUrlStub = sinon.stub(DownloadService.prototype, 'getFragmentSignedUrl');

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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(DownloadService.prototype, 'getAuthorizedDownload').rejects(new HTTP403('Access denied'));

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

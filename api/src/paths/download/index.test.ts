import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDownload, getDownloads } from '.';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { DownloadListRecord } from '../../models/download';
import * as publisher from '../../queue/publisher';
import { DownloadService } from '../../services/download/download-service';
import { SearchFeatureService } from '../../services/search-feature-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';

chai.use(sinonChai);

describe('paths/download/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownload', () => {
    it('should return 400 when no features match the filter criteria', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'nonexistent' } };

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('No features match the filter criteria');
      }
    });

    it('should return 201 with download_id on success', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql({
        download_id: 'uuid-1',
        download_url: 'http://localhost:6100/api/download/uuid-1'
      });
    });

    it('should pass search filters to createDownloadRequest', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([10, 20]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      const createDownloadRequestStub = sinon
        .stub(DownloadService.prototype, 'createDownloadRequest')
        .resolves({ download_id: 'uuid-2' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { feature_types: ['dataset'] } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createDownloadRequestStub.firstCall.args[0]).to.have.deep.property('filters', {
        feature_types: ['dataset']
      });
    });

    it('should not include systemUserId or teamId in createDownloadRequest for anonymous', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      const createDownloadRequestStub = sinon
        .stub(DownloadService.prototype, 'createDownloadRequest')
        .resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'elk' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      const opts = createDownloadRequestStub.firstCall.args[0];
      expect(opts).to.not.have.property('systemUserId');
      expect(opts).to.not.have.property('teamId');
    });

    it('should pass filters to getSearchFeatureIds', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const getSearchFeatureIdsStub = sinon
        .stub(SearchFeatureService.prototype, 'getSearchFeatureIds')
        .resolves([1, 2]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'elk' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getSearchFeatureIdsStub).to.have.been.calledWith({ keyword: 'elk' });
    });

    it('should use getDBConnection when authenticated', async () => {
      const dbConnectionObj = getMockDBConnection();

      const getDBConnectionStub = sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });
      sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = { preferred_username: 'test-user' };
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getDBConnectionStub).to.have.been.calledWith({ preferred_username: 'test-user' });
    });

    it('should use getAPIUserDBConnection when anonymous', async () => {
      const dbConnectionObj = getMockDBConnection();

      const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getAPIUserDBConnectionStub).to.have.been.calledOnce;
    });

    it('should rollback and release on search error', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').rejects(new Error('Search failed'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Search failed');
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
      }
    });

    it('should rollback and release on download creation error', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').rejects(new Error('Download creation failed'));

      const publishStub = sinon.stub(publisher, 'publishProcessDownloadJob');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Download creation failed');
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
        expect(publishStub).to.not.have.been.called;
      }
    });

    it('should publish download job with download_id before commit', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      const publishStub = sinon
        .stub(publisher, 'publishProcessDownloadJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ downloadId: 'uuid-1' });
    });

    it('should rollback and release when publishProcessDownloadJob throws', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({ rollback: rollbackStub, release: releaseStub });

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2]);
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').rejects(new Error('pg-boss unavailable'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('pg-boss unavailable');
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
      }
    });

    it('should exclude secured features from download — only authorized IDs reach createDownloadRequest', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      // Simulate filter removing secured feature 2
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').resolves([1, 3]);
      const createDownloadRequestStub = sinon
        .stub(DownloadService.prototype, 'createDownloadRequest')
        .resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      const ids = createDownloadRequestStub.firstCall.args[0].submissionFeatureIds;
      expect(ids).to.deep.equal([1, 3]);
      expect(ids).to.not.include(2);
    });

    it('should return 400 when all features are secured and user has no policy access', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      // All features secured, none authorized
      sinon.stub(DownloadService.prototype, 'filterAuthorizedFeatureIds').resolves([]);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).message).to.equal('No authorized features match the filter criteria');
      }
    });

    it('should pass null systemUserId to filterAuthorizedFeatureIds for anonymous users', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1]);
      const filterStub = sinon
        .stub(DownloadService.prototype, 'filterAuthorizedFeatureIds')
        .callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(filterStub).to.have.been.calledOnce;
      expect(filterStub.firstCall.args[1]).to.be.null;
    });

    it('should pass systemUserId to filterAuthorizedFeatureIds for authenticated users', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 20 });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1]);
      const filterStub = sinon
        .stub(DownloadService.prototype, 'filterAuthorizedFeatureIds')
        .callsFake((ids) => Promise.resolve(ids));
      sinon.stub(DownloadService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });
      sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(filterStub).to.have.been.calledOnce;
      expect(filterStub.firstCall.args[1]).to.equal(20);
    });
  });

  describe('getDownloads', () => {
    it('re-throws any error that is thrown', async () => {
      const mockDBConnection = getMockDBConnection({
        open: () => {
          throw new Error('test error');
        }
      });

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { page: '1', limit: '25' };

      const requestHandler = getDownloads();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
      }
    });

    it('should return 200 with paginated downloads', async () => {
      const mockDownloads: DownloadListRecord[] = [
        {
          download_id: 'uuid-1',
          download_status: 'ready',
          metadata: null,
          started_at: '2026-01-01',
          completed_at: '2026-01-01',
          downloaded_at: null,
          total_fragments: 1,
          completed_fragments: 1,
          estimated_total_size_bytes: '1000',
          fragment_size_bytes: '1000',
          create_date: '2026-01-01',
          feature_count: 5
        }
      ];

      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon
        .stub(DownloadService.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: mockDownloads, count: 1 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { page: '1', limit: '25' };

      const requestHandler = getDownloads();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.have.property('downloads').that.eql(mockDownloads);
      expect(mockRes.jsonValue).to.have.property('pagination');
      expect(mockRes.jsonValue.pagination).to.have.property('total', 1);
      expect(mockRes.jsonValue.pagination).to.have.property('current_page', 1);
      expect(mockRes.jsonValue.pagination).to.have.property('last_page', 1);
      expect(mockRes.jsonValue.pagination).to.have.property('per_page', 25);
    });

    it('should pass pagination options to service', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      const getDownloadsStub = sinon
        .stub(DownloadService.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: [], count: 0 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = { page: '2', limit: '10' };

      const requestHandler = getDownloads();
      await requestHandler(mockReq, mockRes, mockNext);

      expect(getDownloadsStub).to.have.been.calledOnce;
      expect(getDownloadsStub.firstCall.args[1]).to.eql({
        page: 2,
        limit: 10,
        sort: undefined,
        order: undefined
      });
    });

    it('should apply default pagination when no query params provided', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      const getDownloadsStub = sinon
        .stub(DownloadService.prototype, 'getDownloadsByTeamMembership')
        .resolves({ downloads: [], count: 0 });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.query = {};

      const requestHandler = getDownloads();
      await requestHandler(mockReq, mockRes, mockNext);

      // Default: page=1, limit=25
      expect(getDownloadsStub.firstCall.args[1]).to.eql({
        page: 1,
        limit: 25,
        sort: undefined,
        order: undefined
      });
      expect(mockRes.jsonValue.pagination).to.have.property('current_page', 1);
      expect(mockRes.jsonValue.pagination).to.have.property('per_page', 25);
    });
  });
});

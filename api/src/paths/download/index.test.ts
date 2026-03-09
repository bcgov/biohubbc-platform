import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createDownload, getDownloads } from '.';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import * as publisher from '../../queue/publisher';
import { DownloadPipelineService } from '../../services/download/download-pipeline-service';
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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(0);

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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(3);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      sinon.stub(DownloadPipelineService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql({ download_id: 'uuid-1' });
    });

    it('should pass search filters to createDownloadRequest', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([10, 20]);
      const createDownloadRequestStub = sinon
        .stub(DownloadPipelineService.prototype, 'createDownloadRequest')
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

    it('should pass systemUserId=null, teamId=null for anonymous', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(3);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      const createDownloadRequestStub = sinon
        .stub(DownloadPipelineService.prototype, 'createDownloadRequest')
        .resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'elk' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      const opts = createDownloadRequestStub.firstCall.args[0];
      expect(opts).to.have.property('systemUserId', null);
      expect(opts).to.have.property('teamId', null);
    });

    it('should pass filters to getSearchFeatureIds', async () => {
      const dbConnectionObj = getMockDBConnection();

      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      const getSearchFeatureIdsStub = sinon
        .stub(SearchFeatureService.prototype, 'getSearchFeatureIds')
        .resolves([1, 2]);
      sinon.stub(DownloadPipelineService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(1);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1]);
      sinon.stub(DownloadPipelineService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
      sinon.stub(publisher, 'publishProcessDownloadJob').resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getDBConnectionStub).to.have.been.calledWith('valid-token');
    });

    it('should use getAPIUserDBConnection when anonymous', async () => {
      const dbConnectionObj = getMockDBConnection();

      const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(1);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1]);
      sinon.stub(DownloadPipelineService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(1);
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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2]);
      sinon
        .stub(DownloadPipelineService.prototype, 'createDownloadRequest')
        .rejects(new Error('Download creation failed'));

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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(3);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2, 3]);
      sinon.stub(DownloadPipelineService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
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
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeatureIds').resolves([1, 2]);
      sinon.stub(DownloadPipelineService.prototype, 'createDownloadRequest').resolves({ download_id: 'uuid-1' } as any);
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
      const mockDownloads = [
        { download_id: 'uuid-1', download_status: 'ready', create_date: '2026-01-01', feature_count: 5 }
      ];

      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      sinon.stub(DownloadService.prototype, 'getDownloadsByTeamMembership').resolves(mockDownloads as any);
      sinon.stub(DownloadService.prototype, 'getDownloadsByTeamMembershipCount').resolves(1);

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
      const getDownloadsStub = sinon.stub(DownloadService.prototype, 'getDownloadsByTeamMembership').resolves([]);
      const getCountStub = sinon.stub(DownloadService.prototype, 'getDownloadsByTeamMembershipCount').resolves(0);

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
      expect(getCountStub).to.have.been.calledOnce;
    });

    it('should apply default pagination when no query params provided', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);
      const getDownloadsStub = sinon.stub(DownloadService.prototype, 'getDownloadsByTeamMembership').resolves([]);
      sinon.stub(DownloadService.prototype, 'getDownloadsByTeamMembershipCount').resolves(0);

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

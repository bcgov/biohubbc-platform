import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as path from '.';
import { createDownload, getDownloads } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { HTTPError } from '../../errors/http-error';
import { DownloadListRecord } from '../../models/download';
import { DownloadService } from '../../services/download/download-service';
import { SearchFeatureService } from '../../services/search-feature-service';

chai.use(sinonChai);

const stubPublishProcessDownloadJob = () =>
  sinon.stub(path.downloadPathDependencies, 'publishProcessDownloadJob').resolves({
    status: 'published',
    jobId: 'job-1'
  });

const stubAnonymousCreateDownloadBase = (dbConnectionObj = getMockDBConnection(), matchingFeaturesCount = 1) => {
  sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
  sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(matchingFeaturesCount);
  return dbConnectionObj;
};

describe('paths/download/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownload', () => {
    it('should return 400 when no features match the filter criteria', async () => {
      stubAnonymousCreateDownloadBase(getMockDBConnection(), 0);

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
      stubAnonymousCreateDownloadBase(getMockDBConnection(), 3);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      stubPublishProcessDownloadJob();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      const apiHost = process.env.API_HOST || 'localhost';
      const apiPort = process.env.API_PORT || '6100';
      const baseUrl = apiHost === 'localhost' ? `http://${apiHost}:${apiPort}` : `https://${apiHost}`;

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.eql({
        download_id: 'uuid-1',
        download_url: `${baseUrl}/api/download/uuid-1`
      });
    });

    it('should pass search filters to createDownload', async () => {
      stubAnonymousCreateDownloadBase(getMockDBConnection(), 2);
      const createDownloadStub = sinon
        .stub(DownloadService.prototype, 'createDownload')
        .resolves({ download_id: 'uuid-2' });
      stubPublishProcessDownloadJob();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { feature_types: ['dataset'] } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(createDownloadStub.firstCall.args[0]).to.deep.equal({
        filters: { feature_types: ['dataset'] },
        format: 'parquet'
      });
    });

    it('should pass null systemUserId to getSearchFeaturesCount for anonymous users', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      const getCountStub = sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      stubPublishProcessDownloadJob();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = undefined as any;
      mockReq.body = { filters: { keyword: 'elk' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getCountStub).to.have.been.calledOnce;
      expect(getCountStub.firstCall.args[0]).to.deep.equal({ keyword: 'elk' });
      expect(getCountStub.firstCall.args[1]).to.be.null;
    });

    it('should pass systemUserId to getSearchFeaturesCount for authenticated users', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 20 });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      const getCountStub = sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(1);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      sinon
        .stub(path.downloadPathDependencies, 'publishProcessDownloadJob')
        .resolves({ status: 'published', jobId: 'job-1' });
      sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getCountStub).to.have.been.calledOnce;
      expect(getCountStub.firstCall.args[1]).to.equal(20);
    });

    it('should use getDBConnection when authenticated', async () => {
      const dbConnectionObj = getMockDBConnection();

      const getDBConnectionStub = sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(1);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      stubPublishProcessDownloadJob();
      sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.keycloak_token = 'valid-token';
      mockReq.body = { filters: { keyword: 'moose' } };

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(getDBConnectionStub).to.have.been.calledWith('valid-token');
    });

    it('should use getAPIUserDBConnection when anonymous', async () => {
      const dbConnectionObj = getMockDBConnection();

      const getAPIUserDBConnectionStub = sinon
        .stub(db.dbDependencies, 'getAPIUserDBConnection')
        .returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(1);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      stubPublishProcessDownloadJob();

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').rejects(new Error('Search failed'));

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      sinon.stub(DownloadService.prototype, 'createDownload').rejects(new Error('Download creation failed'));

      const publishStub = sinon.stub(path.downloadPathDependencies, 'publishProcessDownloadJob');

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
      stubAnonymousCreateDownloadBase(getMockDBConnection(), 3);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      const publishStub = stubPublishProcessDownloadJob();

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

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(dbConnectionObj);
      sinon.stub(SearchFeatureService.prototype, 'getSearchFeaturesCount').resolves(2);
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'uuid-1' });
      sinon.stub(path.downloadPathDependencies, 'publishProcessDownloadJob').rejects(new Error('pg-boss unavailable'));

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

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);

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
          format: 'parquet',
          metadata: null,
          started_at: '2026-01-01',
          completed_at: '2026-01-01',
          downloaded_at: null,
          total_fragments: 1,
          completed_fragments: 1,
          estimated_total_size_bytes: '1000',
          fragment_size_bytes: '1000',
          create_date: '2026-01-01'
        }
      ];

      const mockDBConnection = getMockDBConnection();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
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
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
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
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(mockDBConnection);
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

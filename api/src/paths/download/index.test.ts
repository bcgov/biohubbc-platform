import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as path from '.';
import { createDownload, getDownloads } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as db from '../../database/db';
import { HTTP400, HTTPError } from '../../errors/http-error';
import { DownloadListRecord } from '../../models/download';
import { DownloadPolicyService } from '../../services/download/download-policy-service';
import { DownloadService } from '../../services/download/download-service';
import { ExpressionTreeService } from '../../services/expression-tree-service';

chai.use(sinonChai);

const validExpression = {
  type: 'expression' as const,
  operator: 'AND' as const,
  clauses: [
    {
      type: 'predicate' as const,
      feature_property_id: 1,
      feature_type_property_id: 2,
      operator: 'Equals' as const,
      value: 'moose'
    }
  ]
};

const validBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'My download',
  description: 'A description',
  featureTypes: ['observation'],
  expression: validExpression,
  ...overrides
});

describe('paths/download/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownload', () => {
    it('returns 400 when featureTypes is empty', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 20 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody({ featureTypes: [] });

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect(error).to.be.instanceOf(HTTP400);
      }
    });

    it('returns 400 when featureTypes is omitted', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 20 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      const body = validBody();
      delete (body as { featureTypes?: unknown }).featureTypes;
      mockReq.body = body;

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
      }
    });

    it('returns 400 on unknown body key', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 20 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody({ ui_id: 'leaked-from-frontend' });

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
      }
    });

    it('returns 400 when expression.clauses is empty', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 20 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody({
        expression: {
          type: 'expression',
          operator: 'AND',
          clauses: []
        }
      });

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
      }
    });

    it('propagates a 400 thrown by writeExpressionTree (semantic validation)', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 20,
        rollback: rollbackStub,
        release: releaseStub
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .rejects(new HTTP400('Invalid predicate value for property'));

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody();

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
      }
    });

    it('returns 201 on the happy path with an expression and calls services in order', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const writeExpressionTreeStub = sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .resolves({ expression_id: 'expr-uuid-1' });
      const createDownloadPolicyStub = sinon
        .stub(DownloadPolicyService.prototype, 'createDownloadPolicy')
        .resolves({ policy_id: 'policy-uuid-1' });
      const createDownloadServiceStub = sinon
        .stub(DownloadService.prototype, 'createDownload')
        .resolves({ download_id: 'download-uuid-1' });
      const linkDownloadToNewTeamStub = sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();
      const publishStub = sinon
        .stub(path.downloadPathDependencies, 'publishProcessDownloadJob')
        .resolves({ status: 'published', jobId: 'job-1' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody();

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(writeExpressionTreeStub).to.have.been.calledOnce;
      expect(writeExpressionTreeStub.firstCall.args[0]).to.eql(validExpression);

      expect(createDownloadPolicyStub).to.have.been.calledOnce;
      expect(createDownloadPolicyStub.firstCall.args[0]).to.eql({
        name: 'My download',
        description: 'A description',
        featureTypes: ['observation'],
        expressionId: 'expr-uuid-1'
      });

      expect(createDownloadServiceStub).to.have.been.calledOnce;
      expect(createDownloadServiceStub.firstCall.args[0]).to.eql({
        policyId: 'policy-uuid-1',
        format: 'parquet'
      });

      expect(linkDownloadToNewTeamStub).to.have.been.calledOnce;
      expect(linkDownloadToNewTeamStub.firstCall.args[0]).to.equal('download-uuid-1');
      expect(linkDownloadToNewTeamStub.firstCall.args[1]).to.equal(42);

      expect(publishStub).to.have.been.calledOnce;
      expect(publishStub.firstCall.args[1]).to.eql({ downloadId: 'download-uuid-1' });

      expect(writeExpressionTreeStub).to.have.been.calledBefore(createDownloadPolicyStub);
      expect(createDownloadPolicyStub).to.have.been.calledBefore(createDownloadServiceStub);
      expect(createDownloadServiceStub).to.have.been.calledBefore(linkDownloadToNewTeamStub);
      expect(linkDownloadToNewTeamStub).to.have.been.calledBefore(publishStub);

      expect(mockRes.statusValue).to.equal(201);
      expect(mockRes.jsonValue).to.have.property('download_id', 'download-uuid-1');
      expect(mockRes.jsonValue).to.have.property('download_url').that.is.a('string');
      expect(mockRes.jsonValue.download_url).to.match(/\/api\/download\/download-uuid-1$/);
    });

    it('returns 201 on the broad path: expression null skips writeExpressionTree', async () => {
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42 });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const writeExpressionTreeStub = sinon
        .stub(ExpressionTreeService.prototype, 'writeExpressionTree')
        .resolves({ expression_id: 'should-not-be-called' });
      const createDownloadPolicyStub = sinon
        .stub(DownloadPolicyService.prototype, 'createDownloadPolicy')
        .resolves({ policy_id: 'policy-uuid-2' });
      sinon.stub(DownloadService.prototype, 'createDownload').resolves({ download_id: 'download-uuid-2' });
      sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();
      sinon
        .stub(path.downloadPathDependencies, 'publishProcessDownloadJob')
        .resolves({ status: 'published', jobId: 'job-2' });

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody({ expression: null });

      const requestHandler = createDownload();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(writeExpressionTreeStub).to.not.have.been.called;
      expect(createDownloadPolicyStub).to.have.been.calledOnce;
      expect(createDownloadPolicyStub.firstCall.args[0]).to.eql({
        name: 'My download',
        description: 'A description',
        featureTypes: ['observation'],
        expressionId: null
      });
      expect(mockRes.statusValue).to.equal(201);
    });

    it('rolls back and releases when DownloadService.createDownload throws mid-flow', async () => {
      const rollbackStub = sinon.stub();
      const releaseStub = sinon.stub();
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 20,
        rollback: rollbackStub,
        release: releaseStub
      });

      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon.stub(ExpressionTreeService.prototype, 'writeExpressionTree').resolves({ expression_id: 'expr-uuid' });
      sinon.stub(DownloadPolicyService.prototype, 'createDownloadPolicy').resolves({ policy_id: 'policy-uuid' });
      sinon.stub(DownloadService.prototype, 'createDownload').rejects(new Error('Download creation failed'));

      const linkStub = sinon.stub(DownloadService.prototype, 'linkDownloadToNewTeam').resolves();
      const publishStub = sinon.stub(path.downloadPathDependencies, 'publishProcessDownloadJob');

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'valid-token';
      mockReq.body = validBody();

      const requestHandler = createDownload();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Download creation failed');
        expect(rollbackStub).to.have.been.calledOnce;
        expect(releaseStub).to.have.been.calledOnce;
        expect(linkStub).to.not.have.been.called;
        expect(publishStub).to.not.have.been.called;
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
          create_date: '2026-01-01',
          exports: []
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

    it('forwards populated exports on each download row', async () => {
      const mockDownloads: DownloadListRecord[] = [
        {
          download_id: 'uuid-1',
          download_status: 'ready',
          format: 'csv',
          metadata: null,
          started_at: '2026-01-01',
          completed_at: '2026-01-01',
          downloaded_at: null,
          create_date: '2026-01-01',
          exports: [
            {
              download_export_id: 'eeee0000-0000-0000-0000-000000000001',
              download_id: 'uuid-1',
              format: 'csv',
              status: 'ready',
              mode: 'per_feature_type',
              max_part_size_bytes: '524288000',
              started_at: '2026-01-01',
              completed_at: '2026-01-01',
              error_message: null,
              part_count: 2
            }
          ]
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
      expect(mockRes.jsonValue.downloads[0].exports).to.have.length(1);
      expect(mockRes.jsonValue.downloads[0].exports[0]).to.have.property(
        'download_export_id',
        'eeee0000-0000-0000-0000-000000000001'
      );
      expect(mockRes.jsonValue.downloads[0].exports[0]).to.have.property('part_count', 2);
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

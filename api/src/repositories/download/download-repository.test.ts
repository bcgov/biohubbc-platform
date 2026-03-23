import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DownloadStatusEnum } from '../../models/download-status';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { DownloadRepository } from './download-repository';

chai.use(sinonChai);

describe('DownloadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownload', () => {
    it('inserts download with status, fragment_size_bytes, and filters only', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownload({});

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.not.include('system_user_id');
      expect(sqlText).to.not.include('team_id');
      expect(sqlText).to.not.include('data_request_id');
      expect(sqlText).to.include('fragment_size_bytes');
    });

    it('serializes filters as JSONB in SQL', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const filters = { keyword: 'moose' };
      await repo.createDownload({ filters });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('filters');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(JSON.stringify(filters));
    });

    it('passes null filters when filters is omitted', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownload({});

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      const filtersValue = sqlValues[sqlValues.length - 1];
      expect(filtersValue).to.be.null;
    });
  });

  describe('createDownloadFeatures', () => {
    it('inserts join table rows for each feature ID using unnest', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 3));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadFeatures('aaaa0000-0000-0000-0000-000000000001', [10, 20, 30]);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('unnest');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.deep.include([10, 20, 30]);
    });

    it('handles single feature ID', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadFeatures('aaaa0000-0000-0000-0000-000000000001', [10]);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.deep.include([10]);
    });
  });

  describe('createDownloadTeam', () => {
    it('inserts into download_team with downloadId and teamId', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadTeam('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001');

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_team');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include('bbbb0000-0000-0000-0000-000000000001');
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.createDownloadTeam('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001');
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to link download to team');
      }
    });
  });

  describe('updateDownloadStatus', () => {
    it('updates status with metadata', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.updateDownloadStatus('aaaa0000-0000-0000-0000-000000000001', DownloadStatusEnum.READY, {
        completed_at: '2025-01-01T00:01:00Z'
      });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.READY);
      expect(sqlValues).to.include('2025-01-01T00:01:00Z');
    });

    it('updates status without metadata', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.updateDownloadStatus('aaaa0000-0000-0000-0000-000000000001', DownloadStatusEnum.FAILED);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.FAILED);
    });
  });

  describe('findDownloadById', () => {
    it('SQL includes create_date in SELECT', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('create_date');
    });
  });

  describe('getDownloadsByTeamMembership', () => {
    it('returns download records and count from knex query', async () => {
      const mockRows = [
        { download_id: 'uuid-1', download_status: 'ready', feature_count: 5, total_count: 2 },
        { download_id: 'uuid-2', download_status: 'pending', feature_count: 0, total_count: 2 }
      ];
      const mockResponse = {
        rowCount: 2,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadsByTeamMembership(123);

      expect(result.count).to.equal(2);
      expect(result.downloads).to.have.length(2);
      expect(result.downloads[0]).to.not.have.property('total_count');
    });

    it('returns paginated results when pagination is provided', async () => {
      const mockRows = [{ download_id: 'uuid-1', feature_count: 3, total_count: 5 }];
      const mockResponse = {
        rowCount: 1,
        rows: mockRows
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadsByTeamMembership(123, { page: 2, limit: 10 });

      expect(result.count).to.equal(5);
      expect(result.downloads).to.have.length(1);
    });

    it('returns empty array and zero count when no downloads exist', async () => {
      const mockResponse = {
        rowCount: 0,
        rows: []
      } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });
      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadsByTeamMembership(123);

      expect(result.downloads).to.eql([]);
      expect(result.count).to.equal(0);
    });
  });

  describe('isUserAuthorizedForDownload', () => {
    it('checks authorization via download_team and team_member', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ authorized: true }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.isUserAuthorizedForDownload('aaaa0000-0000-0000-0000-000000000001', 42);

      expect(result).to.be.true;
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_team');
      expect(sqlText).to.include('team_member');
      expect(sqlText).to.not.include('download_share');
      expect(sqlText).to.not.include('d.system_user_id');
    });

    it('returns false when user is not authorized', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ authorized: false }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.isUserAuthorizedForDownload('aaaa0000-0000-0000-0000-000000000001', 42);

      expect(result).to.be.false;
    });

    it('returns false when result rows are empty', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.isUserAuthorizedForDownload('aaaa0000-0000-0000-0000-000000000001', 42);

      expect(result).to.be.false;
    });
  });

  describe('isDownloadClaimedByTeam', () => {
    it('returns true when download has team associations', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ has_teams: true }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.isDownloadClaimedByTeam('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.be.true;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_team');
      expect(sqlText).to.include('record_end_date IS NULL');
    });

    it('returns false when download has no team associations', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ has_teams: false }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.isDownloadClaimedByTeam('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.be.false;
    });

    it('returns false when result rows are empty', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.isDownloadClaimedByTeam('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.be.false;
    });
  });

  describe('getDownloadFeatures', () => {
    it('returns all features linked to a download without security filtering', async () => {
      const mockResponse = { rowCount: 0, rows: [] } as unknown as Promise<QueryResult<any>>;
      const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadFeatures('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.eql([]);
    });
  });

  describe('getSecuredFeatureIds', () => {
    it('returns empty set when given empty array', async () => {
      const sqlStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getSecuredFeatureIds([]);

      expect(result).to.deep.equal(new Set());
      expect(sqlStub).to.not.have.been.called;
    });

    it('queries submission_feature_security with ANY() for given IDs', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ submission_feature_id: 10 }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getSecuredFeatureIds([10, 20]);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('submission_feature_security');
      expect(sqlText).to.include('ANY(');
      expect(sqlText).to.include('record_end_date IS NULL');
      expect(result).to.deep.equal(new Set([10]));
    });
  });

  describe('getUserAuthorizedSecuredFeatureIds', () => {
    it('returns empty set when given empty array', async () => {
      const knexStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getUserAuthorizedSecuredFeatureIds([], 1);

      expect(result).to.deep.equal(new Set());
      expect(knexStub).to.not.have.been.called;
    });

    it('uses scope-based walk-up with security_scope_anchor and team_security_scope', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ submission_feature_id: 10 }], 1));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getUserAuthorizedSecuredFeatureIds([10, 20], 99);

      expect(knexStub).to.have.been.calledOnce;
      const queryString = knexStub.firstCall.args[0].toString();

      // New scope-based tables
      expect(queryString).to.include('security_scope_anchor');
      expect(queryString).to.include('team_security_scope');
      expect(queryString).to.include('team_member');

      // Old policy-based tables no longer used
      expect(queryString).to.not.include('team_policy');
      expect(queryString).to.not.include('policy_statement');

      // systemUserId threaded into SQL
      expect(queryString).to.include('99');

      expect(result).to.deep.equal(new Set([10]));
    });

    it('returns empty set when no features are authorized', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getUserAuthorizedSecuredFeatureIds([10, 20], 5);

      expect(knexStub).to.have.been.calledOnce;
      expect(result).to.deep.equal(new Set());
    });
  });
});

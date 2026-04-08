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
    it('inserts download with status, fragment_size_bytes, filters, and cart_id', async () => {
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
      expect(sqlText).to.include('cart_id');
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
      // filters is second-to-last, cart_id is last
      expect(sqlValues[sqlValues.length - 2]).to.be.null;
    });

    it('passes cartId value in SQL when provided', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const cartId = 'cccc0000-0000-0000-0000-000000000001';
      await repo.createDownload({ cartId });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(cartId);
    });

    it('passes null cart_id when cartId is omitted', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownload({ filters: { keyword: 'moose' } });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      // cart_id is the last parameter
      expect(sqlValues[sqlValues.length - 1]).to.be.null;
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

  describe('createDownloadArtifact', () => {
    it('inserts into download_artifact with downloadId, artifactId, and format', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadArtifact(
        'aaaa0000-0000-0000-0000-000000000001',
        'bbbb0000-0000-0000-0000-000000000001',
        'parquet'
      );

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_artifact');
      expect(sqlText).to.include('artifact_id');
      expect(sqlText).to.include('format');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include('bbbb0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include('parquet');
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.createDownloadArtifact(
          'aaaa0000-0000-0000-0000-000000000001',
          'bbbb0000-0000-0000-0000-000000000001',
          'parquet'
        );
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Failed to link artifact to download');
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
        { download_id: 'uuid-1', download_status: 'ready', total_count: 2 },
        { download_id: 'uuid-2', download_status: 'pending', total_count: 2 }
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

    it('SQL does not reference download_feature', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.getDownloadsByTeamMembership(123);

      expect(knexStub).to.have.been.calledOnce;
      const builtQuery = knexStub.firstCall.args[0];
      const sqlText = builtQuery.toString();
      expect(sqlText).to.not.include('download_feature');
      expect(sqlText).to.not.include('feature_count');
    });

    it('returns paginated results when pagination is provided', async () => {
      const mockRows = [{ download_id: 'uuid-1', total_count: 5 }];
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

  describe('getDownloadSource', () => {
    it('returns cart_id, filters, and create_user for a download', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(
          mockQueryResult([{ cart_id: 'cccc0000-0000-0000-0000-000000000001', filters: null, create_user: 42 }], 1)
        );
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadSource('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal({
        cart_id: 'cccc0000-0000-0000-0000-000000000001',
        filters: null,
        create_user: 42
      });
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('cart_id');
      expect(sqlText).to.include('filters');
      expect(sqlText).to.include('create_user');
    });

    it('throws ApiExecuteSQLError when download not found', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.getDownloadSource('bad-id');
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Download not found');
      }
    });
  });

  describe('getDownloadFeaturesByCartId', () => {
    it('joins cart_submission_feature to submission_feature and feature_type', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [
          { submission_feature_id: 1, submission_id: 10, feature_type_name: 'observation', estimated_byte_size: '500' }
        ]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadFeaturesByCartId('cccc0000-0000-0000-0000-000000000001');

      expect(result).to.have.length(1);
      expect(result[0]).to.have.property('submission_feature_id');
      expect(result[0]).to.have.property('feature_type_name');
      expect(result[0]).to.have.property('estimated_byte_size');

      const builtQuery = knexStub.firstCall.args[0];
      const sqlText = builtQuery.toString();
      expect(sqlText).to.include('cart_submission_feature');
      expect(sqlText).to.include('submission_feature');
      expect(sqlText).to.include('feature_type');
    });
  });

  describe('getDownloadFeaturesBySearchQuery', () => {
    it('uses whereIn with Knex subquery and calls connection.knex once', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [
          { submission_feature_id: 1, submission_id: 10, feature_type_name: 'observation', estimated_byte_size: '500' }
        ]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      // Create a mock subquery (a Knex.QueryBuilder-like object)
      const mockSubquery = { toString: () => 'SELECT submission_feature_id FROM ...' } as any;

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadFeaturesBySearchQuery(mockSubquery);

      expect(result).to.have.length(1);
      // connection.knex should be called exactly once (the outer query, not the subquery)
      expect(knexStub).to.have.been.calledOnce;
    });
  });

  describe('getDownloadTotalSizeByCartId', () => {
    it('returns aggregate row with total', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [{ total: 15000 }]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadTotalSizeByCartId('cccc0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal({ total: 15000 });
    });

    it('returns row with null total when cart has no features', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [{ total: null }]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadTotalSizeByCartId('cccc0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal({ total: null });
    });
  });

  describe('getDownloadTotalSizeBySearchQuery', () => {
    it('returns aggregate row with total', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [{ total: 25000 }]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const mockSubquery = { toString: () => 'SELECT submission_feature_id FROM ...' } as any;

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadTotalSizeBySearchQuery(mockSubquery);

      expect(result).to.deep.equal({ total: 25000 });
    });

    it('returns row with null total when no features match', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [{ total: null }]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const mockSubquery = { toString: () => 'SELECT submission_feature_id FROM ...' } as any;

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadTotalSizeBySearchQuery(mockSubquery);

      expect(result).to.deep.equal({ total: null });
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
});

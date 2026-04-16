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
      await repo.createDownload({ format: 'csv' });

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
      await repo.createDownload({ filters, format: 'csv' });

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
      await repo.createDownload({ format: 'csv' });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      // filters is third-to-last, cart_id second-to-last, format last
      expect(sqlValues[sqlValues.length - 3]).to.be.null;
    });

    it('passes cartId value in SQL when provided', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const cartId = 'cccc0000-0000-0000-0000-000000000001';
      await repo.createDownload({ cartId, format: 'csv' });

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
      await repo.createDownload({ filters: { keyword: 'moose' }, format: 'csv' });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      // cart_id is second-to-last parameter (format is last)
      expect(sqlValues[sqlValues.length - 2]).to.be.null;
      expect(sqlValues[sqlValues.length - 1]).to.equal('csv');
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
    it('inserts into download_artifact with downloadId and artifactId', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadArtifact('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001');

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_artifact');
      expect(sqlText).to.include('artifact_id');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include('bbbb0000-0000-0000-0000-000000000001');
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.createDownloadArtifact(
          'aaaa0000-0000-0000-0000-000000000001',
          'bbbb0000-0000-0000-0000-000000000001'
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

  describe('getDownloadArtifact', () => {
    it('returns artifact_id and object_key from download_artifact JOIN artifact', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(
          mockQueryResult(
            [{ artifact_id: 'bbbb0000-0000-0000-0000-000000000001', object_key: 'downloads/some-file.parquet' }],
            1
          )
        );
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadArtifact('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal({
        artifact_id: 'bbbb0000-0000-0000-0000-000000000001',
        object_key: 'downloads/some-file.parquet'
      });

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_artifact');
      expect(sqlText).to.include('artifact');
      expect(sqlText).to.include('object_key');
    });

    it('throws ApiExecuteSQLError when not found', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.getDownloadArtifact('bad-id');
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Download artifact not found');
      }
    });
  });

  describe('listDownloadFeatureTypesByCartId', () => {
    it('returns ordered feature type names with DISTINCT', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ feature_type_name: 'dataset' }, { feature_type_name: 'observation' }], 2));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.listDownloadFeatureTypesByCartId('cccc0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal(['dataset', 'observation']);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('DISTINCT');
      expect(sqlText).to.include('cart_submission_feature');
      expect(sqlText).to.include('feature_type');
      expect(sqlText).to.include('ORDER BY');
    });

    it('returns empty array when cart has no features', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.listDownloadFeatureTypesByCartId('cccc0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal([]);
    });
  });

  describe('listDownloadFeatureTypesBySearchQuery', () => {
    it('returns ordered feature type names from knex query', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 2,
        rows: [{ feature_type_name: 'dataset' }, { feature_type_name: 'observation' }]
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const mockSubquery = { toString: () => 'SELECT submission_feature_id FROM ...' } as any;

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.listDownloadFeatureTypesBySearchQuery(mockSubquery);

      expect(result).to.deep.equal(['dataset', 'observation']);
      expect(knexStub).to.have.been.calledOnce;
    });

    it('returns empty array when no features match', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const mockSubquery = { toString: () => 'SELECT submission_feature_id FROM ...' } as any;

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.listDownloadFeatureTypesBySearchQuery(mockSubquery);

      expect(result).to.deep.equal([]);
    });
  });

  describe('streamFeatureBaseByCartIdAndType', () => {
    it('yields batches via DECLARE/FETCH/CLOSE cursor sequence', async () => {
      const queryStub = sinon.stub();

      // Call 0: DECLARE cursor
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      // Call 1: FETCH with data
      queryStub.onCall(1).resolves({
        rows: [
          {
            submission_feature_id: 1,
            uuid: 'uuid-1',
            feature_type_name: 'observation',
            data: { properties: {} },
            parent_uuid: null
          },
          {
            submission_feature_id: 2,
            uuid: 'uuid-2',
            feature_type_name: 'observation',
            data: { properties: {} },
            parent_uuid: 'parent-uuid-1'
          }
        ],
        rowCount: 2
      });
      // Call 2: FETCH empty (end of cursor)
      queryStub.onCall(2).resolves({ rows: [], rowCount: 0 });
      // Call 3: CLOSE
      queryStub.onCall(3).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const batches: any[][] = [];
      for await (const batch of repo.streamFeatureBaseByCartIdAndType(
        'cccc0000-0000-0000-0000-000000000001',
        'observation'
      )) {
        batches.push(batch);
      }

      expect(batches).to.have.length(1);
      expect(batches[0]).to.have.length(2);
      expect(batches[0][0]).to.have.property('submission_feature_id', 1);
      expect(batches[0][0]).to.have.property('parent_uuid', null);
      expect(batches[0][1]).to.have.property('parent_uuid', 'parent-uuid-1');

      // Verify DECLARE, FETCH, FETCH, CLOSE sequence
      expect(queryStub.callCount).to.equal(4);
      expect(queryStub.getCall(0).args[0]).to.include('DECLARE');
      expect(queryStub.getCall(0).args[0]).to.include('cart_submission_feature');
      expect(queryStub.getCall(1).args[0]).to.include('FETCH');
      expect(queryStub.getCall(2).args[0]).to.include('FETCH');
      expect(queryStub.getCall(3).args[0]).to.include('CLOSE');
    });

    it('calls CLOSE even when FETCH throws', async () => {
      const queryStub = sinon.stub();

      // DECLARE succeeds
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      // FETCH throws
      queryStub.onCall(1).rejects(new Error('DB failure'));
      // CLOSE should still be called
      queryStub.onCall(2).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _batch of repo.streamFeatureBaseByCartIdAndType(
          'cccc0000-0000-0000-0000-000000000001',
          'observation'
        )) {
          // should not reach here
        }
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('DB failure');
      }

      // CLOSE must have been called despite the error
      const closeCall = queryStub.getCalls().find((c) => String(c.args[0]).includes('CLOSE'));
      expect(closeCall).to.not.be.undefined;
    });
  });

  describe('streamFeatureBaseBySearchQueryAndType', () => {
    it('yields batches via cursor with search subquery bindings', async () => {
      const queryStub = sinon.stub();

      // DECLARE
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      // FETCH with data
      queryStub.onCall(1).resolves({
        rows: [
          {
            submission_feature_id: 5,
            uuid: 'uuid-5',
            feature_type_name: 'observation',
            data: { properties: {} },
            parent_uuid: 'parent-uuid-5'
          }
        ],
        rowCount: 1
      });
      // FETCH empty
      queryStub.onCall(2).resolves({ rows: [], rowCount: 0 });
      // CLOSE
      queryStub.onCall(3).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const batches: any[][] = [];
      for await (const batch of repo.streamFeatureBaseBySearchQueryAndType(
        'dddd0000-0000-0000-0000-000000000001',
        'SELECT submission_feature_id FROM search_results WHERE x = $1',
        ['search-val'],
        'observation'
      )) {
        batches.push(batch);
      }

      expect(batches).to.have.length(1);
      expect(batches[0][0]).to.have.property('submission_feature_id', 5);

      // Verify DECLARE includes search SQL and feature type binding
      const declareArgs = queryStub.getCall(0).args;
      expect(declareArgs[0]).to.include('DECLARE');
      expect(declareArgs[0]).to.include('submission_feature');
      // Bindings include search value + feature type name
      expect(declareArgs[1]).to.deep.equal(['search-val', 'observation']);

      expect(queryStub.getCall(3).args[0]).to.include('CLOSE');
    });

    it('calls CLOSE even when FETCH throws', async () => {
      const queryStub = sinon.stub();

      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).rejects(new Error('Search cursor failure'));
      queryStub.onCall(2).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _batch of repo.streamFeatureBaseBySearchQueryAndType(
          'dddd0000-0000-0000-0000-000000000001',
          'SELECT sf_id FROM search WHERE x = $1',
          ['val'],
          'observation'
        )) {
          // should not reach here
        }
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Search cursor failure');
      }

      const closeCall = queryStub.getCalls().find((c) => String(c.args[0]).includes('CLOSE'));
      expect(closeCall).to.not.be.undefined;
    });
  });

  describe('fetchTypedPropertyRows', () => {
    it('returns raw typed rows for string properties', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [{ submission_feature_id: 1, name: 'site_name', value: 'Alpha Site' }] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['string']);

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({ submission_feature_id: 1, name: 'site_name', value: 'Alpha Site' });
    });

    it('queries contributor_codeset_code for code properties', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [{ submission_feature_id: 1, name: 'status', value: 'Active' }] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['code']);

      const codeQuery = queryStub.getCalls().find((c) => String(c.args[0]).includes('contributor_codeset_code'));
      expect(codeQuery).to.not.be.undefined;
    });

    it('queries taxon table for taxon properties', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [{ submission_feature_id: 1, name: 'species', value: 'Alces alces' }] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['taxon']);

      const taxonQuery = queryStub.getCalls().find((c) => String(c.args[0]).includes('itis_scientific_name'));
      expect(taxonQuery).to.not.be.undefined;
    });

    it('uses ST_AsGeoJSON for spatial properties', async () => {
      const queryStub = sinon.stub();
      const geoJson = { type: 'Point', coordinates: [-123.5, 48.4] };
      queryStub.resolves({ rows: [{ submission_feature_id: 1, name: 'location', value: geoJson }] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['spatial']);

      expect(result[0].value).to.deep.equal(geoJson);

      const spatialQuery = queryStub.getCalls().find((c) => String(c.args[0]).includes('ST_AsGeoJSON'));
      expect(spatialQuery).to.not.be.undefined;
    });

    it('queries only typed tables for property types requested', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['string', 'number']);

      expect(queryStub.callCount).to.equal(2);

      const queryTexts = queryStub.getCalls().map((c) => String(c.args[0]));
      expect(queryTexts.some((t) => t.includes('submission_feature_property_string'))).to.be.true;
      expect(queryTexts.some((t) => t.includes('submission_feature_property_number'))).to.be.true;
      expect(queryTexts.some((t) => t.includes('submission_feature_property_code'))).to.be.false;
    });

    it('skips unknown property type names', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['unknown_type']);

      expect(queryStub.callCount).to.equal(0);
      expect(result).to.have.length(0);
    });

    it('flattens results from multiple typed tables into a single array', async () => {
      const queryStub = sinon.stub();
      queryStub.onFirstCall().resolves({ rows: [{ submission_feature_id: 1, name: 'site_name', value: 'Alpha' }] });
      queryStub.onSecondCall().resolves({ rows: [{ submission_feature_id: 1, name: 'count', value: 42 }] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['string', 'number']);

      expect(result).to.have.length(2);
      expect(result.find((r) => r.name === 'site_name')?.value).to.equal('Alpha');
      expect(result.find((r) => r.name === 'count')?.value).to.equal(42);
    });
  });

  describe('updateArtifactStatusByDownloadId', () => {
    it('updates artifact status via download_artifact join', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.updateArtifactStatusByDownloadId(
        'aaaa0000-0000-0000-0000-000000000001',
        'uploaded',
        '2025-01-01T00:01:00Z'
      );

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('UPDATE artifact');
      expect(sqlText).to.include('download_artifact');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('uploaded');
      expect(sqlValues).to.include('2025-01-01T00:01:00Z');
    });

    it('throws when no artifact found for download', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.updateArtifactStatusByDownloadId(
          'aaaa0000-0000-0000-0000-000000000001',
          'uploaded',
          '2025-01-01T00:01:00Z'
        );
        expect.fail('Expected an error');
      } catch (error) {
        expect((error as Error).message).to.include('Failed to update artifact status');
      }
    });
  });
});

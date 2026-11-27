import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { CountResult } from '../../models/count';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionFeature } from '../../models/download-version';
import { BaseFeatureRow, DownloadRepository } from './download-repository';

chai.use(sinonChai);

describe('DownloadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownload', () => {
    it('binds policyId, format, and requestedBy and returns the inserted row', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.createDownload({
        policyId: 'pppp0000-0000-0000-0000-000000000001',
        format: 'parquet',
        requestedBy: 42
      });

      expect(result).to.deep.equal({ download_id: 'aaaa0000-0000-0000-0000-000000000001' });
      expect(sqlStub).to.have.been.calledOnce;

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('pppp0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.include('parquet');
      expect(sqlValues).to.include(42);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.createDownload({
          policyId: 'pppp0000-0000-0000-0000-000000000001',
          format: 'parquet',
          requestedBy: 42
        });
        expect.fail('Expected ApiExecuteSQLError');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to insert download record');
      }
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

  describe('getDownloadById', () => {
    it('returns the download record when found', async () => {
      const row = { download_id: 'aaaa0000-0000-0000-0000-000000000001', download_status: DownloadStatusEnum.PENDING };
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const download = await repo.getDownloadById('aaaa0000-0000-0000-0000-000000000001');

      expect(download).to.equal(row);
    });

    it('throws ApiNotFoundError when no row is returned', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.getDownloadById('aaaa0000-0000-0000-0000-000000000001');
        expect.fail('expected throw');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Download not found');
      }
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

    it('SQL LEFT JOINs the policy table for name and description', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.match(/LEFT JOIN\s+policy/i);
      expect(sqlText).to.include('p.name');
      expect(sqlText).to.include('p.description');
    });

    it('SQL selects the resolved dv.download_version_id', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('dv.download_version_id');
      // The dropped stored pointer must be gone — reads resolve the most-recent version instead.
      expect(sqlText).to.not.include('current_download_version_id');
    });

    it('SQL sources status/timing from the most-recent active version (INNER JOIN LATERAL)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.match(/INNER JOIN\s+LATERAL/i);
      expect(sqlText).to.include('record_end_date IS NULL');
      expect(sqlText).to.match(/ORDER BY\s+create_date\s+DESC/i);
      expect(sqlText).to.match(/dv\.status\s+AS\s+download_status/i);
      expect(sqlText).to.include('dv.started_at');
      expect(sqlText).to.include('dv.completed_at');
    });

    it('returns the joined detail row when policy description is non-null', async () => {
      const mockRow = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        download_status: DownloadStatusEnum.READY,
        format: 'parquet',
        metadata: null,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        downloaded_at: null,
        create_date: '2026-01-01T00:00:00.000Z',
        download_version_id: 'dddd0000-0000-0000-0000-000000000001',
        name: 'My download',
        description: 'A nice description'
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockRow], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.not.be.null;
      expect(result?.name).to.equal('My download');
      expect(result?.description).to.equal('A nice description');
    });

    it('returns the joined detail row when policy description is null', async () => {
      const mockRow = {
        download_id: 'aaaa0000-0000-0000-0000-000000000001',
        download_status: DownloadStatusEnum.READY,
        format: 'parquet',
        metadata: null,
        started_at: null,
        completed_at: null,
        downloaded_at: null,
        create_date: '2026-01-01T00:00:00.000Z',
        download_version_id: 'dddd0000-0000-0000-0000-000000000002',
        name: 'My download',
        description: null
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([mockRow], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.findDownloadById('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.not.be.null;
      expect(result?.name).to.equal('My download');
      expect(result?.description).to.be.null;
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
      expect(sqlText).to.include('join "team" as "t" on "t"."team_id" = "dt"."team_id"');
      expect(sqlText).to.include('"t"."record_end_date" is null');
    });

    it('SQL resolves the most-recent active version via INNER JOIN LATERAL', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.getDownloadsByTeamMembership(123);

      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.match(/inner join lateral/i);
      expect(sqlText).to.include('"dv"."download_version_id"');
      expect(sqlText).to.include('record_end_date IS NULL');
      expect(sqlText).to.match(/order by\s+create_date\s+desc/i);
      // The dropped stored pointer must be gone.
      expect(sqlText).to.not.include('current_download_version_id');
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

    it('applies requested sorting to the joined download query', async () => {
      const knexStub = sinon.stub().resolves({
        rowCount: 0,
        rows: []
      } as unknown as QueryResult<any>);
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.getDownloadsByTeamMembership(123, {
        page: 1,
        limit: 10,
        sort: 'create_date',
        order: 'desc'
      });

      const sqlText = knexStub.firstCall.args[0].toString();
      expect(sqlText).to.include('order by "create_date" desc');
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
    it('returns policy_id and requested_by for a download', async () => {
      const row = { policy_id: 'pppp0000-0000-0000-0000-000000000001', requested_by: 42 };
      const sqlStub = sinon.stub().resolves(mockQueryResult([row], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.getDownloadSource('aaaa0000-0000-0000-0000-000000000001');

      expect(result).to.deep.equal(row);
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('policy_id');
      expect(sqlText).to.include('requested_by');
    });

    it('throws ApiNotFoundError when download not found', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);

      try {
        await repo.getDownloadSource('bad-id');
        expect.fail('Expected ApiNotFoundError');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Download not found');
      }
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
      const sqlText = sqlStub.firstCall.args[0].text.toLowerCase();
      expect(sqlText).to.include('download_team');
      expect(sqlText).to.include('join team t on t.team_id = dt.team_id');
      expect(sqlText).to.include('team_member');
      expect(sqlText).to.include('t.record_end_date is null');
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

  describe('streamFeatureBaseByFeatureIds', () => {
    const DOWNLOAD_ID = 'dddd0000-0000-0000-0000-000000000001';
    const FEATURE_IDS = Buffer.from('feature-type-bitmap');

    it('declares a cursor over the given feature-id bitmap alone, with no feature type or version predicate', async () => {
      // Verifies: the cursor iterates the feature type's own part of the set, so it never walks the
      // version's whole set to filter it by type

      // Step 1: Setup the DECLARE, one FETCH with data, an empty FETCH and the CLOSE
      const queryStub = sinon.stub();
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      const row: BaseFeatureRow = {
        submission_feature_id: 5,
        uuid: 'uuid-5',
        feature_type_name: 'observation',
        data: {},
        parent_uuid: 'parent-uuid-5'
      };
      queryStub.onCall(1).resolves({ rows: [row], rowCount: 1 });
      queryStub.onCall(2).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(3).resolves({ rows: [], rowCount: 0 });

      // Step 2: Create repository with mocked connection
      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Consume the stream
      const batches: BaseFeatureRow[][] = [];
      for await (const batch of repo.streamFeatureBaseByFeatureIds(DOWNLOAD_ID, 'observation', FEATURE_IDS, 50)) {
        batches.push(batch);
      }

      // Step 4: The cursor iterates the bound bitmap (no array is built) and joins submission_feature
      // by primary key; it reads no version row and filters by no feature type
      const [declareSql, declareBindings] = queryStub.getCall(0).args;
      expect(declareSql).to.include('DECLARE dl_pq_version_cursor_dddd0000_0000_0000_0000_000000000001_observation');
      expect(declareSql).to.include('FROM rb_iterate($1::bytea::roaringbitmap)');
      expect(declareSql).to.not.include('rb_to_array');
      expect(declareSql).to.not.include('download_version');
      expect(declareSql).to.not.include('ft.name =');
      expect(declareSql).to.include('sf.submission_feature_id = version_feature.submission_feature_id');

      // Step 5: The only binding is the feature type's bitmap
      expect(declareBindings).to.deep.equal([FEATURE_IDS]);

      // Step 6: The batch size drives FETCH, and the cursor is closed
      expect(queryStub.getCall(1).args[0]).to.include('FETCH 50 FROM');
      expect(queryStub.getCall(3).args[0]).to.include('CLOSE');

      // Step 7: The fetched batch is yielded as it came from the cursor
      expect(batches).to.have.length(1);
      expect(batches[0][0]).to.have.property('submission_feature_id', 5);
    });

    it('calls CLOSE even when FETCH throws', async () => {
      // Verifies: a failed FETCH still closes the cursor before the error surfaces

      // Step 1: DECLARE succeeds, the first FETCH rejects, CLOSE succeeds
      const queryStub = sinon.stub();
      queryStub.onCall(0).resolves({ rows: [], rowCount: 0 });
      queryStub.onCall(1).rejects(new Error('Search cursor failure'));
      queryStub.onCall(2).resolves({ rows: [], rowCount: 0 });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      // Step 2: Pull the first batch and capture the error
      const stream = repo.streamFeatureBaseByFeatureIds(DOWNLOAD_ID, 'observation', FEATURE_IDS);
      try {
        await stream.next();
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err.message).to.equal('Search cursor failure');
      }

      // Step 3: The cursor was closed

      const closeCall = queryStub.getCalls().find((c) => String(c.args[0]).includes('CLOSE'));
      expect(closeCall).to.not.be.undefined;
    });
  });

  describe('listFeaturesByFeatureIdsQuery', () => {
    it('embeds the feature-id subquery and binds LIMIT and OFFSET after its bindings', async () => {
      // Verifies: the page's parameters come after the subquery's own, the offset is that of the
      // requested page, and the rows are validated against the feature model

      // Step 1: Setup mock DB
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repo = new DownloadRepository(getMockDBConnection({ knex: knexStub }));

      // Step 2: Ask for page 3 at 10 per page of a subquery that has two bindings of its own
      const featureIdsSql = 'SELECT sf.submission_feature_id FROM submission_feature sf WHERE a = ? AND b = ?';
      await repo.listFeaturesByFeatureIdsQuery(featureIdsSql, ['observation', 7], {
        page: 3,
        limit: 10,
        sort: 'uuid',
        order: 'desc'
      });

      // Step 3: The subquery is the id source, and LIMIT / OFFSET take the next two positions
      const { sql: sqlText, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sqlText).to.include(
        'WHERE sf.submission_feature_id IN (SELECT sf.submission_feature_id FROM submission_feature sf WHERE a = $1 AND b = $2)'
      );
      expect(sqlText).to.match(/ORDER BY sf\.submission_feature_id\s+LIMIT \$3\s+OFFSET \$4$/);

      // Step 4: Bindings are the subquery's, then the limit, then the offset of page 3
      expect(bindings).to.deep.equal(['observation', 7, 10, 20]);

      // Step 5: The rows are validated against the feature model
      expect(knexStub.firstCall.args[1]).to.equal(DownloadVersionFeature);
    });
  });

  describe('getFeaturesByFeatureIdsQueryCount', () => {
    it('counts the rows of the feature-id subquery with its own bindings, unpaged', async () => {
      // Verifies: the count wraps the same subquery, adds no parameters of its own, and is validated

      // Step 1: Setup mock DB to return a count row
      const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 6 }], 1));
      const repo = new DownloadRepository(getMockDBConnection({ knex: knexStub }));

      // Step 2: Count a subquery that has two bindings
      const featureIdsSql = 'SELECT sf.submission_feature_id FROM submission_feature sf WHERE a = ? AND b = ?';
      const result = await repo.getFeaturesByFeatureIdsQueryCount(featureIdsSql, ['observation', 7]);

      // Step 3: The subquery is counted as a derived table, with exactly its bindings
      expect(knexStub.firstCall.args[0].toSQL().toNative()).to.deep.equal({
        sql: 'SELECT count(*)::integer AS count FROM (SELECT sf.submission_feature_id FROM submission_feature sf WHERE a = $1 AND b = $2) ids',
        bindings: ['observation', 7]
      });

      // Step 4: The row is validated as a count, and its number (not the row) is returned
      expect(knexStub.firstCall.args[1]).to.equal(CountResult);
      expect(result).to.equal(6);
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

    it('expands datetime into UNION ALL of _date and _time arms over the timestamp table', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['datetime']);

      const datetimeQuery = queryStub
        .getCalls()
        .map((c) => String(c.args[0]))
        .find((sql) => sql.includes('submission_feature_property_timestamp'));
      expect(datetimeQuery, 'expected datetime branch query').to.not.be.undefined;
      // The split read projection: each component is filtered to non-null and aliased
      // with the suffixed name. Two arms joined by UNION ALL preserve partial-component data.
      expect(datetimeQuery).to.include('date_value');
      expect(datetimeQuery).to.include('time_value');
      expect(datetimeQuery).to.include('_date');
      expect(datetimeQuery).to.include('_time');
      expect(datetimeQuery).to.include('UNION ALL');
      // The old `p.value` reference must be gone — the timestamp table no longer has that column.
      expect(/\bp\.value\b/.test(datetimeQuery!), 'datetime SQL must not reference p.value').to.be.false;
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
      // When `feature` is absent from the requested property types, the feature-arm SQL must not run.
      expect(queryTexts.some((t) => t.includes('submission_feature_property_feature'))).to.be.false;

      // When `feature` is present, the feature-arm SQL is included.
      queryStub.resetHistory();
      await repo.fetchTypedPropertyRows([1], ['string', 'feature']);
      const featureQueryTexts = queryStub.getCalls().map((c) => String(c.args[0]));
      expect(featureQueryTexts.some((t) => t.includes('submission_feature_property_feature'))).to.be.true;
    });

    it('returns a single-element string array for a feature property with one referenced feature', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({
        rows: [{ submission_feature_id: 100, name: 'related_feature', value: ['urn:1:obs:42'] }]
      });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([100], ['feature']);

      expect(result).to.deep.include({
        submission_feature_id: 100,
        name: 'related_feature',
        value: ['urn:1:obs:42']
      });

      const sqlText = String(queryStub.getCall(0).args[0]);
      expect(sqlText).to.include('jsonb_agg');
      expect(sqlText).to.include('submission_feature_property_feature');
      expect(sqlText).to.include('ORDER BY sf.submission_feature_id');
    });

    it('returns an ordered multi-element string array for a feature property with multiple referenced features', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({
        rows: [{ submission_feature_id: 100, name: 'related_feature', value: ['urn:1:obs:42', 'urn:1:obs:43'] }]
      });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([100], ['feature']);

      expect(result[0].value).to.deep.equal(['urn:1:obs:42', 'urn:1:obs:43']);
    });

    it('includes the referenced feature active-window filter', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([100], ['feature']);

      const sqlText = String(queryStub.getCall(0).args[0]);
      expect(sqlText).to.include('sf.record_effective_date <= now()');
      expect(sqlText).to.include('sf.record_end_date IS NULL');
      expect(sqlText).to.include('now() < sf.record_end_date');
      expect(sqlText).to.include('referenced_submission_feature_id');
    });

    it('hydrates artifact_key rows only when the feature type has one artifact_key property', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([100], ['artifact_key']);

      const sqlText = String(queryStub.getCall(0).args[0]);
      expect(sqlText).to.include('submission_feature_artifact sfa');
      expect(sqlText).to.include("a.artifact_status = 'uploaded'");
      expect(sqlText).to.include('artifact_bftp.feature_type_id = sf.feature_type_id');
      expect(sqlText).to.include("fpt.name = 'artifact_key'");
      expect(sqlText).to.include('HAVING COUNT(*) = 1');
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
});

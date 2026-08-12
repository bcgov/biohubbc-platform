import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadRepository } from './download-repository';

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
    it('returns raw typed rows tagged with their storage type', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });
      queryStub.withArgs(sinon.match(/submission_feature_property_string/)).resolves({
        rows: [{ submission_feature_id: 1, name: 'site_name', value: 'Alpha Site', storage_type: 'string' }]
      });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['string'], 'observation');

      expect(result).to.have.length(1);
      expect(result[0]).to.deep.equal({
        submission_feature_id: 1,
        name: 'site_name',
        value: 'Alpha Site',
        storage_type: 'string'
      });
    });

    it('queries contributor_codeset_code for code properties', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['code'], 'observation');

      const codeQuery = queryStub.getCalls().find((c) => String(c.args[0]).includes('contributor_codeset_code'));
      expect(codeQuery).to.not.be.undefined;
    });

    it('queries taxon table for taxon properties', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['taxon'], 'observation');

      const taxonQuery = queryStub.getCalls().find((c) => String(c.args[0]).includes('itis_scientific_name'));
      expect(taxonQuery).to.not.be.undefined;
    });

    it('expands datetime into UNION ALL of _date and _time arms over the timestamp table', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['datetime'], 'observation');

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

    // A typed table records where a value was stored, not what the property is declared as —
    // redeclaring a property does not relocate its rows. Scalar tables are therefore read
    // WITHOUT a declared-type filter (the merge layer decides what a foreign-stored value can
    // become), while structurally-typed tables keep it: their value shapes exist solely for
    // their own declared type.
    for (const [typeName, table] of [
      ['string', 'submission_feature_property_string'],
      ['number', 'submission_feature_property_number'],
      ['boolean', 'submission_feature_property_boolean'],
      ['code', 'submission_feature_property_code'],
      ['taxon', 'submission_feature_property_taxon']
    ] as const) {
      it(`reads the ${typeName} table without a declared-type filter, scoped to the feature type`, async () => {
        const queryStub = sinon.stub();
        queryStub.resolves({ rows: [] });

        const mockDBConnection = getMockDBConnection({ query: queryStub });
        const repo = new DownloadRepository(mockDBConnection);

        await repo.fetchTypedPropertyRows([1], [typeName], 'observation');

        const call = queryStub.getCalls().find((candidate) => String(candidate.args[0]).includes(table));
        expect(call, `expected a query against ${table}`).to.not.be.undefined;

        const sql = String(call!.args[0]);
        expect(sql).to.not.include(`fpt.name = '${typeName}'`);
        expect(sql).to.include(`'${typeName}' AS storage_type`);
        // Scoped to one feature type's active properties, never by declared type.
        expect(sql).to.include('ft.name = $2');
        expect(sql).to.include('ft.record_end_date IS NULL');
        expect(sql).to.include('ftp.record_end_date IS NULL');
        expect(sql).to.include('fp.record_end_date IS NULL');
        // PK ordering keeps multi-row merges stable across reruns.
        expect(sql).to.match(/ORDER BY p\.submission_feature_property_\w+_id/);
        expect(call!.args[1]).to.deep.equal([[1], 'observation']);
      });
    }

    for (const [typeName, table] of [
      ['datetime', 'submission_feature_property_timestamp'],
      ['spatial', 'submission_feature_property_geometry'],
      ['feature', 'submission_feature_property_feature']
    ] as const) {
      it(`constrains the ${typeName} query to properties declared as '${typeName}'`, async () => {
        const queryStub = sinon.stub();
        queryStub.resolves({ rows: [] });

        const mockDBConnection = getMockDBConnection({ query: queryStub });
        const repo = new DownloadRepository(mockDBConnection);

        await repo.fetchTypedPropertyRows([1], [typeName], 'observation');

        const sql = queryStub
          .getCalls()
          .map((call) => String(call.args[0]))
          .find((candidate) => candidate.includes(table));

        expect(sql, `expected a query against ${table}`).to.not.be.undefined;
        expect(sql).to.include('feature_property_type fpt');
        expect(sql).to.include(`fpt.name = '${typeName}'`);
        expect(sql).to.include('fpt.record_end_date IS NULL');
        expect(sql).to.include('ft.name = $2');
      });
    }

    it('scopes artifact_key to its declared type through the artifact_ftp subquery', async () => {
      // This one derives its feature_type_property from a subquery that already filters on
      // the type, so it needs no `declaredAs` join — but it must still be type-scoped.
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['artifact_key'], 'file');

      const sql = queryStub
        .getCalls()
        .map((call) => String(call.args[0]))
        .find((candidate) => candidate.includes('submission_feature_artifact'));

      expect(sql).to.not.be.undefined;
      expect(sql).to.include(`fpt.name = 'artifact_key'`);
    });

    it('uses ST_AsGeoJSON for spatial properties', async () => {
      const queryStub = sinon.stub();
      const geoJson = { type: 'Point', coordinates: [-123.5, 48.4] };
      queryStub.resolves({
        rows: [{ submission_feature_id: 1, name: 'location', value: geoJson, storage_type: 'spatial' }]
      });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['spatial'], 'observation');

      expect(result[0].value).to.deep.equal(geoJson);

      const spatialQuery = queryStub.getCalls().find((c) => String(c.args[0]).includes('ST_AsGeoJSON'));
      expect(spatialQuery).to.not.be.undefined;
    });

    it('queries every scalar table when any scalar-family property type is requested', async () => {
      // A scalar property's rows can live in any scalar table (redeclaring a property does
      // not relocate rows), so limiting the scan to the declared types would hide exactly
      // the rows the storage_type tag exists to surface.
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['string', 'number'], 'observation');

      expect(queryStub.callCount).to.equal(5);

      const queryTexts = queryStub.getCalls().map((c) => String(c.args[0]));
      for (const table of [
        'submission_feature_property_string',
        'submission_feature_property_number',
        'submission_feature_property_boolean',
        'submission_feature_property_code',
        'submission_feature_property_taxon'
      ]) {
        expect(
          queryTexts.some((t) => t.includes(table)),
          `expected a query against ${table}`
        ).to.be.true;
      }
      // Structurally-typed tables still run only when their type is declared.
      expect(queryTexts.some((t) => t.includes('submission_feature_property_feature'))).to.be.false;
      expect(queryTexts.some((t) => t.includes('submission_feature_property_timestamp'))).to.be.false;

      // When `feature` is present, the feature-arm SQL is included.
      queryStub.resetHistory();
      await repo.fetchTypedPropertyRows([1], ['string', 'feature'], 'observation');
      const featureQueryTexts = queryStub.getCalls().map((c) => String(c.args[0]));
      expect(featureQueryTexts.some((t) => t.includes('submission_feature_property_feature'))).to.be.true;
    });

    it('does not query scalar tables when only structural types are requested', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([1], ['spatial'], 'observation');

      expect(queryStub.callCount).to.equal(1);
      expect(String(queryStub.getCall(0).args[0])).to.include('submission_feature_property_geometry');
    });

    it('returns a single-element string array for a feature property with one referenced feature', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({
        rows: [{ submission_feature_id: 100, name: 'related_feature', value: ['urn:1:obs:42'] }]
      });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([100], ['feature'], 'observation');

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

      const result = await repo.fetchTypedPropertyRows([100], ['feature'], 'observation');

      expect(result[0].value).to.deep.equal(['urn:1:obs:42', 'urn:1:obs:43']);
    });

    it('includes the referenced feature active-window filter', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      await repo.fetchTypedPropertyRows([100], ['feature'], 'observation');

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

      await repo.fetchTypedPropertyRows([100], ['artifact_key'], 'file');

      const sqlText = String(queryStub.getCall(0).args[0]);
      expect(sqlText).to.include('submission_feature_artifact sfa');
      expect(sqlText).to.include("a.artifact_status = 'uploaded'");
      expect(sqlText).to.include('artifact_ftp.feature_type_id = sf.feature_type_id');
      expect(sqlText).to.include("fpt.name = 'artifact_key'");
      expect(sqlText).to.include('HAVING COUNT(*) = 1');
    });

    it('skips unknown property type names', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['unknown_type'], 'observation');

      expect(queryStub.callCount).to.equal(0);
      expect(result).to.have.length(0);
    });

    it('flattens results from multiple typed tables into a single array', async () => {
      const queryStub = sinon.stub();
      queryStub.resolves({ rows: [] });
      queryStub
        .withArgs(sinon.match(/submission_feature_property_string/))
        .resolves({ rows: [{ submission_feature_id: 1, name: 'site_name', value: 'Alpha', storage_type: 'string' }] });
      queryStub
        .withArgs(sinon.match(/submission_feature_property_number/))
        .resolves({ rows: [{ submission_feature_id: 1, name: 'count', value: 42, storage_type: 'number' }] });

      const mockDBConnection = getMockDBConnection({ query: queryStub });
      const repo = new DownloadRepository(mockDBConnection);

      const result = await repo.fetchTypedPropertyRows([1], ['string', 'number'], 'observation');

      expect(result).to.have.length(2);
      expect(result.find((r) => r.name === 'site_name')?.value).to.equal('Alpha');
      expect(result.find((r) => r.name === 'count')?.value).to.equal(42);
    });
  });
});

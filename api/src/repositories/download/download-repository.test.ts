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

    it('uses ON CONFLICT ... WHERE record_end_date IS NULL DO NOTHING for retry idempotency', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadArtifact('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001');

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('ON CONFLICT');
      expect(sqlText).to.include('record_end_date IS NULL');
      expect(sqlText).to.include('DO NOTHING');
    });

    it('does not throw when rowCount is 0 (conflict — link already exists)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownloadArtifact('aaaa0000-0000-0000-0000-000000000001', 'bbbb0000-0000-0000-0000-000000000001');

      expect(sqlStub).to.have.been.calledOnce;
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

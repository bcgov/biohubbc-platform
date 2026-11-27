import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { createMockDownloadVersion } from '../../__mocks__/download';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionFeature } from '../../models/download-version';
import { DownloadVersionRepository } from './download-version-repository';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';
const ARTIFACT_ID = 'bbbb0000-0000-0000-0000-000000000001';

describe('DownloadVersionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadVersion', () => {
    it('INSERTs into download_version, RETURNs download_version_id, and binds downloadId', async () => {
      // Verifies: the INSERT targets the version table, returns the new id, and binds the parent download

      // Step 1: Setup mock DB to return one inserted version row
      const sqlStub = sinon.stub().resolves(mockQueryResult([createMockDownloadVersion()], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call createDownloadVersion with a download id
      await repo.createDownloadVersion(DOWNLOAD_ID);

      // Step 4: Verify SQL shape and bound values
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('INSERT INTO download_version');
      expect(sqlText).to.include('RETURNING');
      expect(sqlText).to.include('download_version_id');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DOWNLOAD_ID);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: a failed INSERT (rowCount != 1) is surfaced as an error, not a silent null return

      // Step 1: Setup mock DB to return zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiExecuteSQLError
      try {
        await repo.createDownloadVersion(DOWNLOAD_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to insert download version record');
      }
    });
  });

  describe('createDownloadVersionArtifact', () => {
    it('SQL is ON CONFLICT … DO NOTHING and binds [versionId, artifactId, featureTypeName]', async () => {
      // Verifies: the idempotent link insert uses the partial-unique upsert clause and binds the 3 link cols

      // Step 1: Setup mock DB (rowCount 1 — the inserting path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call with a feature type name
      await repo.createDownloadVersionArtifact(VERSION_ID, ARTIFACT_ID, 'observation');

      // Step 4: Verify ON CONFLICT clause and the bound link columns
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('ON CONFLICT');
      expect(sqlText).to.include('DO NOTHING');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.deep.equal([VERSION_ID, ARTIFACT_ID, 'observation']);
    });

    it('does not throw when rowCount is 0 (idempotent conflict no-op)', async () => {
      // Verifies: a re-insert on a still-active link (rowCount 0) is a valid silent no-op, not an error

      // Step 1: Setup mock DB to return zero rows (conflict path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call createDownloadVersionArtifact
      const result = await repo.createDownloadVersionArtifact(VERSION_ID, ARTIFACT_ID, null);

      // Step 4: Verify it resolved without throwing
      expect(result).to.be.undefined;
      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('updateDownloadVersionStatus', () => {
    it('UPDATEs download_version status/timing/error and binds the version id', async () => {
      // Verifies: the lifecycle write targets download_version (not download), sets
      // status + all four COALESCE columns, and binds the version id + status.

      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadVersionRepository(mockDBConnection);

      await repo.updateDownloadVersionStatus(VERSION_ID, DownloadStatusEnum.READY, {
        completed_at: '2026-01-01T00:01:00.000Z',
        materialized_at: '2026-01-01T00:01:00.000Z'
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('UPDATE download_version');
      expect(sqlText).to.match(/status\s*=/);
      expect(sqlText).to.include('started_at = COALESCE');
      expect(sqlText).to.include('completed_at = COALESCE');
      expect(sqlText).to.include('materialized_at = COALESCE');
      expect(sqlText).to.include('error_message = COALESCE');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.READY);
      expect(sqlValues).to.include(VERSION_ID);
    });

    it('includes feature_count = COALESCE and binds the provided count', async () => {
      // Verifies: the materialized feature count is written through the same set-once-
      // preserve-later COALESCE pattern as the timestamps, and the provided value is bound.

      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadVersionRepository(mockDBConnection);

      await repo.updateDownloadVersionStatus(VERSION_ID, DownloadStatusEnum.READY, {
        completed_at: '2026-01-01T00:01:00.000Z',
        materialized_at: '2026-01-01T00:01:00.000Z',
        feature_count: 42
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('feature_count = COALESCE');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(42);
    });

    it('binds null for feature_count when absent so COALESCE preserves the stored value', async () => {
      // Verifies: a transition that doesn't own the count (here: FAILED) binds null into
      // feature_count's COALESCE, so an already-materialized count is never cleared.

      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadVersionRepository(mockDBConnection);

      // Every sibling metadata field carries a real value so the ONLY null bind left is
      // feature_count's — a bare `.include(null)` would be satisfied by any sibling COALESCE.
      await repo.updateDownloadVersionStatus(VERSION_ID, DownloadStatusEnum.FAILED, {
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        materialized_at: '2026-01-01T00:01:00.000Z',
        error_message: 'boom'
      });

      const sqlValues = sqlStub.firstCall.args[0].values;
      const nullBinds = sqlValues.filter((value: unknown) => value === null);
      expect(nullBinds).to.have.length(1);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: an UPDATE that matched no version row is surfaced as an error

      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadVersionRepository(mockDBConnection);

      try {
        await repo.updateDownloadVersionStatus(VERSION_ID, DownloadStatusEnum.FAILED);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to update download version status');
      }
    });
  });

  describe('getDownloadVersion', () => {
    it('SELECTs the lifecycle status columns from download_version, binds the version id, and returns the row', async () => {
      // Verifies: the canonical version read surfaces the full lifecycle row.

      // Step 1: Setup mock DB to return one status row
      const statusRow = {
        download_version_id: VERSION_ID,
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.READY,
        feature_count: 42,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        materialized_at: '2026-01-01T00:01:00.000Z',
        error_message: null,
        create_date: '2026-01-01T00:00:00.000Z'
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([statusRow], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call the get method
      const result = await repo.getDownloadVersion(VERSION_ID);

      // Step 4: Verify the returned row, the SELECTed columns, and the bound version id
      expect(result).to.equal(statusRow);

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_version');
      expect(sqlText).to.include('download_version_id');
      expect(sqlText).to.include('download_id');
      expect(sqlText).to.include('status');
      expect(sqlText).to.include('feature_count');
      expect(sqlText).to.include('started_at');
      expect(sqlText).to.include('completed_at');
      expect(sqlText).to.include('materialized_at');
      expect(sqlText).to.include('error_message');
      expect(sqlText).to.include('create_date');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(VERSION_ID);
    });

    it('throws ApiNotFoundError when no version matches', async () => {
      // Verifies: the get* variant maps an empty result to a 404-mapping ApiNotFoundError

      // Step 1: Setup mock DB to return no rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiNotFoundError
      try {
        await repo.getDownloadVersion(VERSION_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Download version not found');
      }
    });
  });

  describe('updateDownloadVersionFeatureIds', () => {
    it('aggregates the feature-id subquery into a run-optimised bitmap and binds the version id after its bindings', async () => {
      // Verifies: the subquery is embedded, its bindings keep their positions, and the version id comes last

      // Step 1: Setup mock DB
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Store a set from a subquery with two bindings of its own
      const featureIdsSql = 'SELECT sf.submission_feature_id FROM submission_feature sf WHERE a = ? AND b = ?';
      await repo.updateDownloadVersionFeatureIds(VERSION_ID, featureIdsSql, ['survey', 7]);

      // Step 4: The set is built in the database, run-optimised, with an empty-set fallback
      const { sql: sqlText, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sqlText).to.include('UPDATE download_version');
      expect(sqlText).to.include('SET feature_ids = rb_runoptimize(COALESCE((');
      expect(sqlText).to.include(
        'SELECT rb_build_agg(ids.submission_feature_id) FROM (SELECT sf.submission_feature_id FROM submission_feature sf WHERE a = $1 AND b = $2) ids'
      );
      expect(sqlText).to.include(`rb_build('{}'::integer[])`);

      // Step 5: The version id is the parameter after the subquery's own, and the set is written once
      expect(sqlText).to.include('WHERE download_version_id = $3');
      expect(sqlText).to.include('AND record_end_date IS NULL');
      expect(sqlText).to.include('AND feature_ids IS NULL');
      expect(bindings).to.deep.equal(['survey', 7, VERSION_ID]);

      // Step 6: A write: no row schema is passed
      expect(knexStub.firstCall.args[1]).to.equal(undefined);
    });

    it('stores the empty bitmap with no subquery when featureIdsSql is null', async () => {
      // Verifies: the null branch writes an empty set and binds only the version id

      // Step 1: Setup mock DB and repository
      const knexStub = sinon.stub().resolves(mockQueryResult([], 1));
      const repo = new DownloadVersionRepository(getMockDBConnection({ knex: knexStub }));

      // Step 2: Store with no subquery
      await repo.updateDownloadVersionFeatureIds(VERSION_ID, null, []);

      // Step 3: No aggregate is run; the version id is the only parameter
      const { sql: sqlText, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
      expect(sqlText).to.include(`SET feature_ids = rb_runoptimize(rb_build('{}'::integer[]))`);
      expect(sqlText).to.not.include('rb_build_agg');
      expect(sqlText).to.include('WHERE download_version_id = $1');
      expect(sqlText).to.include('AND feature_ids IS NULL');
      expect(bindings).to.deep.equal([VERSION_ID]);
    });

    it('does not throw when no row is updated (the set was already stored)', async () => {
      // Verifies: rowCount 0 is the retry path, not an error
      const knexStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repo = new DownloadVersionRepository(getMockDBConnection({ knex: knexStub }));

      await repo.updateDownloadVersionFeatureIds(VERSION_ID, 'SELECT 1 AS submission_feature_id', []);

      expect(knexStub).to.have.been.calledOnce;
    });
  });

  describe('findDownloadVersionFeatureSetSize', () => {
    it('returns null when the version row has no stored set', async () => {
      // Verifies: a NULL cardinality (feature_ids IS NULL) maps to null, not 0
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ feature_set_size: null }], 1));
      const repo = new DownloadVersionRepository(getMockDBConnection({ sql: sqlStub }));

      const result = await repo.findDownloadVersionFeatureSetSize(VERSION_ID);

      expect(result).to.equal(null);
      expect(sqlStub.firstCall.args[0].text).to.include('rb_cardinality(feature_ids)::integer AS feature_set_size');
      expect(sqlStub.firstCall.args[0].values).to.deep.equal([VERSION_ID]);
    });

    it('returns null when no version matches', async () => {
      // Verifies: find* maps an empty result to null
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const repo = new DownloadVersionRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repo.findDownloadVersionFeatureSetSize(VERSION_ID)).to.equal(null);
    });

    it('returns 0 for an empty stored set (distinct from no set)', async () => {
      // Verifies: an explicit 0 survives the null-coalescing
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ feature_set_size: 0 }], 1));
      const repo = new DownloadVersionRepository(getMockDBConnection({ sql: sqlStub }));

      expect(await repo.findDownloadVersionFeatureSetSize(VERSION_ID)).to.equal(0);
    });
  });

  describe('listDownloadVersionFeatureTypeNames', () => {
    it('iterates the active version stored set for its distinct feature type names and returns the raw rows', async () => {
      // Verifies: the query iterates the version's own bitmap (no array is built), skips an ended
      // version, and the rows are returned as they came from the query

      // Step 1: Setup mock DB to return two name rows
      const rows: { name: string }[] = [{ name: 'capture' }, { name: 'survey' }];
      const sqlStub = sinon.stub().resolves(mockQueryResult(rows, 2));
      const repo = new DownloadVersionRepository(getMockDBConnection({ sql: sqlStub }));

      // Step 2: Call the list method
      const result = await repo.listDownloadVersionFeatureTypeNames(VERSION_ID);

      // Step 3: Verify the raw rows, the SQL shape and the bound version id
      expect(result).to.equal(rows);
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('SELECT DISTINCT');
      expect(sqlText).to.include('FROM rb_iterate((');
      expect(sqlText).to.not.include('rb_to_array');
      expect(sqlText).to.include('AND dv.record_end_date IS NULL');
      expect(sqlText).to.include('ORDER BY ft.name');
      expect(sqlStub.firstCall.args[0].values).to.deep.equal([VERSION_ID]);
    });
  });

  describe('listDownloadVersionFeatures', () => {
    it('cuts the page from the active version stored set with rb_select and reads it by id with the published predicate', async () => {
      // Verifies: only one page of the bitmap is expanded (limit, then the offset of the requested
      // page), an ended version is skipped, and the rows are read by id with the published
      // predicate and no current, closure or security predicate

      // Step 1: Setup mock DB to return one feature row
      const rows: DownloadVersionFeature[] = [
        {
          submission_feature_id: 51,
          uuid: 'ffff0000-0000-0000-0000-000000000051',
          submission_id: 3,
          feature_type_id: 2,
          feature_type_name: 'observation'
        }
      ];
      const sqlStub = sinon.stub().resolves(mockQueryResult(rows, 1));
      const repo = new DownloadVersionRepository(getMockDBConnection({ sql: sqlStub }));

      // Step 2: Ask for page 3 at 25 per page, with a sort the list must ignore
      await repo.listDownloadVersionFeatures(VERSION_ID, {
        page: 3,
        limit: 25,
        sort: 'uuid',
        order: 'desc'
      });

      // Step 3: The page is selected inside the bitmap, from the active version's own set
      const sqlText: string = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('FROM unnest(rb_to_array(rb_select(');
      expect(sqlText).to.include('AND dv.record_end_date IS NULL');
      expect(sqlText).to.include('sf.submission_feature_id = page_feature.submission_feature_id');

      // Step 4: Bound values are the version id, the limit, and the offset of page 3 (2 pages of 25)
      expect(sqlStub.firstCall.args[0].values).to.deep.equal([VERSION_ID, 25, 50]);

      // Step 5: Published is the only lifecycle predicate: no current, closure or security filter,
      // and the order is the fixed ascending id whatever sort was asked for
      expect(sqlText).to.include('WHERE sf.record_effective_date <= now()');
      expect(sqlText).to.not.include('successor_submission_feature_id');
      expect(sqlText).to.not.include('submission_feature_closure');
      expect(sqlText).to.not.include('security');
      expect(sqlText).to.match(/ORDER BY sf\.submission_feature_id;\s*$/);

      // Step 6: The rows are validated against the feature model
      expect(sqlStub.firstCall.args[1]).to.equal(DownloadVersionFeature);
    });
  });

  describe('listDownloadVersionArtifacts', () => {
    it('JOINs artifact, filters record_end_date IS NULL, and binds versionId', async () => {
      // Verifies: the active-artifact lookup joins artifact for object_key and excludes ended links

      // Step 1: Setup mock DB to return an empty row set
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call the list method
      await repo.listDownloadVersionArtifacts(VERSION_ID);

      // Step 4: Verify the JOIN, the active-row filter, and the bound version id
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.match(/JOIN\s+artifact/i);
      expect(sqlText).to.include('record_end_date IS NULL');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(VERSION_ID);
    });
  });

  describe('listDownloadVersions', () => {
    it('returns rows from the paginated list query', async () => {
      const row = {
        download_version_id: VERSION_ID,
        download_id: DOWNLOAD_ID,
        status: DownloadStatusEnum.READY,
        feature_count: 42,
        started_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T00:01:00.000Z',
        materialized_at: '2026-01-01T00:01:00.000Z',
        error_message: null,
        create_date: '2026-01-01T00:00:00.000Z'
      };
      const knexStub = sinon.stub().resolves(mockQueryResult([row]));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadVersionRepository(mockDBConnection);
      const result = await repo.listDownloadVersions(DOWNLOAD_ID, { page: 1, limit: 10 });

      expect(knexStub).to.have.been.calledOnce;
      expect(result).to.eql([row]);
    });
  });

  describe('listDownloadVersionsCount', () => {
    it('returns the download version count', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 3 }]));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadVersionRepository(mockDBConnection);
      const result = await repo.listDownloadVersionsCount(DOWNLOAD_ID);

      expect(knexStub).to.have.been.calledOnce;
      expect(result).to.equal(3);
    });
  });
});

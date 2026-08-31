import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import {
  createMockDownloadVersionExport,
  createMockDownloadVersionExportListRow,
  createMockExportArtifactGroup
} from '../../__mocks__/download';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { ExportConfig } from '../../models/download-export-config';
import { DownloadStatusEnum } from '../../models/download-status';
import { CreateDownloadVersionExportPayload } from '../../models/download-version-export';
import {
  CreateExportArtifactGroupPayload,
  DownloadVersionExportRepository
} from './download-version-export-repository';

chai.use(sinonChai);

const VERSION_ID = 'dddd0000-0000-0000-0000-000000000001';
const GROUP_ID = 'cccc0000-0000-0000-0000-000000000001';
const EXPORT_ID = 'eeee0000-0000-0000-0000-000000000001';
const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000042';
const ARTIFACT_ID = 'bbbb0000-0000-0000-0000-000000000001';
const CONFIG_HASH = 'a'.repeat(64);

const groupConfig: ExportConfig = {
  version: 1,
  export_type: 'csv',
  mode: 'per_feature_type',
  feature_types: ['observation'],
  merge_steps: []
};

const groupPayload: CreateExportArtifactGroupPayload = {
  downloadVersionId: VERSION_ID,
  config: groupConfig,
  configHash: CONFIG_HASH,
  format: 'csv',
  mode: 'per_feature_type',
  maxPartSizeBytes: '524288000',
  exporterVersion: 1
};

const exportPayload: CreateDownloadVersionExportPayload = {
  download_version_id: VERSION_ID,
  download_version_export_artifact_group_id: GROUP_ID,
  format: 'csv',
  mode: 'per_feature_type',
  max_part_size_bytes: '524288000'
};

describe('DownloadVersionExportRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findActiveExportArtifactGroup', () => {
    it('WHERE filters on config_hash (not format/mode), binds configHash, and SELECTs config/config_hash', async () => {
      // Verifies: the dedupe key moved to config_hash — the probe keys on the hash, not the
      // denormalized format/mode columns, and surfaces the inline config back to the caller

      // Step 1: Setup mock DB to return no active group
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call findActiveExportArtifactGroup with the new (versionId, configHash, …) signature
      await repo.findActiveExportArtifactGroup(VERSION_ID, CONFIG_HASH, '524288000', 1);

      // Step 4a: WHERE keys on config_hash + the other dedupe-key columns and excludes ended groups
      const sqlText = sqlStub.firstCall.args[0].text;
      const whereClause = sqlText.slice(sqlText.indexOf('WHERE'));
      expect(whereClause).to.include('config_hash');
      expect(whereClause).to.include('download_version_id');
      expect(whereClause).to.include('max_part_size_bytes');
      expect(whereClause).to.include('exporter_version');
      expect(whereClause).to.include('record_end_date IS NULL');

      // Step 4b: WHERE must NOT filter on the denormalized format/mode columns anymore
      expect(whereClause).to.not.match(/format\s*=/);
      expect(whereClause).to.not.match(/\bmode\s*=/);

      // Step 4c: SELECT list surfaces the inline config + its hash so the job can re-read the recipe
      const selectClause = sqlText.slice(sqlText.indexOf('SELECT'), sqlText.indexOf('FROM'));
      expect(selectClause).to.include('config');
      expect(selectClause).to.include('config_hash');

      // Step 4d: the passed configHash is the bound dedupe value (not a hardcoded format/mode)
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(CONFIG_HASH);
    });

    it('maps a matched row through to a record (incl. config/config_hash)', async () => {
      // Verifies: a found active group is returned as the parsed record, carrying the new config fields

      // Step 1: Setup mock DB to return one active group
      const group = createMockExportArtifactGroup({ config_hash: CONFIG_HASH });
      const sqlStub = sinon.stub().resolves(mockQueryResult([group], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call findActiveExportArtifactGroup
      const result = await repo.findActiveExportArtifactGroup(VERSION_ID, CONFIG_HASH, '524288000', 1);

      // Step 4: Verify the record maps through with its config + config_hash intact
      expect(result?.config_hash).to.equal(CONFIG_HASH);
      expect(result?.config).to.deep.equal(group.config);
    });

    it('returns null when no active group matches', async () => {
      // Verifies: the empty-result path resolves to null (via response.rows[0] ?? null)

      // Step 1: Setup mock DB to return no rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call findActiveExportArtifactGroup
      const result = await repo.findActiveExportArtifactGroup(VERSION_ID, CONFIG_HASH, '524288000', 1);

      // Step 4: Verify the null-row path returns null
      expect(result).to.be.null;
    });
  });

  describe('createExportArtifactGroup', () => {
    it('INSERTs config/config_hash/format/mode and ON CONFLICTs on the config_hash key; returns false (no throw) on rowCount 0', async () => {
      // Verifies: the recipe is stored inline as JSONB config + its hash; the dedupe key is config_hash;
      // and the loser of a race (rowCount 0) is a valid no-op that returns false (did NOT insert), not an error

      // Step 1: Setup mock DB to return zero rows (the conflict / loser path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call createExportArtifactGroup — must resolve false (lost the race), not throw, on rowCount 0
      const result = await repo.createExportArtifactGroup(groupPayload);
      expect(result).to.be.false;

      const sqlText = sqlStub.firstCall.args[0].text;

      // Step 4a: the INSERT column list includes the inline config, its hash, and the denormalized format/mode
      const insertColumns = sqlText.slice(sqlText.indexOf('('), sqlText.indexOf(')'));
      expect(insertColumns).to.include('config');
      expect(insertColumns).to.include('config_hash');
      expect(insertColumns).to.include('format');
      expect(insertColumns).to.include('mode');

      // Step 4b: config is bound as JSONB — the SQL text carries the ::jsonb cast
      expect(sqlText).to.include('::jsonb');

      // Step 4c: ON CONFLICT targets the new config_hash dedupe key (NOT format/mode)
      expect(sqlText).to.include(
        'ON CONFLICT (download_version_id, config_hash, max_part_size_bytes, exporter_version) WHERE record_end_date IS NULL DO NOTHING'
      );

      // Step 4d: config is bound as the stringified recipe; configHash + version key columns are bound
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(JSON.stringify(groupPayload.config));
      expect(sqlValues).to.include(CONFIG_HASH);
      expect(sqlValues).to.include(VERSION_ID);
      expect(sqlValues).to.include('524288000');
      expect(sqlValues).to.include(1);

      // Step 4e: single-write-path rule — format/mode are bound from the config, never independent payload fields
      expect(sqlValues).to.include(groupPayload.config.export_type);
      expect(sqlValues).to.include(groupPayload.config.mode);
    });

    it('binds format/mode from the config even when payload.format/mode disagree (single write path)', async () => {
      // Verifies: format/mode are written ONLY from the parsed config — config_hash already encodes them,
      // so a divergent payload.format/payload.mode must be ignored in favour of config.export_type/config.mode

      // Step 1: Setup mock DB (inserting path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call with payload.format/mode that DISAGREE with the config's export_type/mode
      const divergentPayload: CreateExportArtifactGroupPayload = {
        ...groupPayload,
        format: 'WRONG_FORMAT',
        mode: 'denormalized'
      };
      // rowCount 1 here is the inserting (winner) path → returns true
      const result = await repo.createExportArtifactGroup(divergentPayload);
      expect(result).to.be.true;

      // Step 4: Verify the config-derived values are bound, NOT the divergent payload fields
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(groupConfig.export_type); // 'csv'
      expect(sqlValues).to.include(groupConfig.mode); // 'per_feature_type'
      expect(sqlValues).to.not.include('WRONG_FORMAT');
      expect(sqlValues).to.not.include('denormalized');
    });
  });

  describe('endExportArtifactGroup', () => {
    it('SETs record_end_date and never touches error_message; throws when rowCount is not 1', async () => {
      // Verifies: ending a group only stamps record_end_date — it must preserve error_message history

      // Step 1: Setup mock DB to report one ended row
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call endExportArtifactGroup
      await repo.endExportArtifactGroup(GROUP_ID);

      // Step 4: Verify it sets record_end_date and does NOT overwrite error_message
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('record_end_date');
      expect(sqlText).to.not.contain('error_message');
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: ending a group that matched no active row is surfaced as an error

      // Step 1: Setup mock DB to report zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiExecuteSQLError
      try {
        await repo.endExportArtifactGroup(GROUP_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to end export artifact group');
      }
    });
  });

  describe('updateExportArtifactGroupStatus', () => {
    it('binds completed_at and error_message on the FAILED path', async () => {
      // Verifies: when the service supplies FAILED metadata, both completed_at and error_message are bound

      // Step 1: Setup mock DB to report one updated row
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call with FAILED status and completion + error metadata
      await repo.updateExportArtifactGroupStatus(GROUP_ID, DownloadStatusEnum.FAILED, {
        completed_at: '2026-04-22T01:00:00Z',
        error_message: 'Zip part failed'
      });

      // Step 4: Verify both metadata values are bound
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.FAILED);
      expect(sqlValues).to.include('2026-04-22T01:00:00Z');
      expect(sqlValues).to.include('Zip part failed');
    });

    it('binds null for all 3 metadata slots when metadata is omitted (COALESCE keeps prior values)', async () => {
      // Verifies: a status-only call passes null for started_at/completed_at/error_message so COALESCE keeps prior values

      // Step 1: Setup mock DB to report one updated row
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call with status only (no metadata)
      await repo.updateExportArtifactGroupStatus(GROUP_ID, DownloadStatusEnum.READY);

      // Step 4: Verify the 3 COALESCE metadata slots all receive null
      const sqlValues = sqlStub.firstCall.args[0].values;
      const nullCount = sqlValues.filter((v: unknown) => v === null).length;
      expect(nullCount).to.equal(3);
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: an UPDATE that matched no group row is surfaced as an error

      // Step 1: Setup mock DB to report zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiExecuteSQLError
      try {
        await repo.updateExportArtifactGroupStatus(GROUP_ID, DownloadStatusEnum.READY);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to update export artifact group status');
      }
    });
  });

  describe('createDownloadVersionExport', () => {
    it('INSERTs into download_version_export and RETURNs exactly the 6 thin columns (no lifecycle fields)', async () => {
      // Verifies: the per-user export INSERT returns only the table's own columns — lifecycle lives on the group

      // Step 1: Setup mock DB to return one inserted thin row
      const sqlStub = sinon.stub().resolves(mockQueryResult([createMockDownloadVersionExport()], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call createDownloadVersionExport
      await repo.createDownloadVersionExport(exportPayload);

      // Step 4: Verify the INSERT/VALUES/RETURNING shape and that no group-owned lifecycle field is returned
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('INSERT INTO download_version_export');
      expect(sqlText).to.include('VALUES');
      expect(sqlText).to.include('RETURNING');

      const returningClause = sqlText.slice(sqlText.indexOf('RETURNING'));
      expect(returningClause).to.include('download_version_export_id');
      expect(returningClause).to.include('download_version_export_artifact_group_id');
      expect(returningClause).to.not.contain('status');
      expect(returningClause).to.not.contain('started_at');
      expect(returningClause).to.not.contain('error_message');
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: a failed export INSERT is surfaced as an error, not a silent null return

      // Step 1: Setup mock DB to return zero rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiExecuteSQLError
      try {
        await repo.createDownloadVersionExport(exportPayload);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to insert download version export record');
      }
    });
  });

  describe('createExportArtifactGroupArtifact', () => {
    it('SQL is ON CONFLICT … DO NOTHING and binds [groupId, artifactId, chunkId]', async () => {
      // Verifies: the part-link insert is an idempotent upsert binding the group/artifact/chunk tuple

      // Step 1: Setup mock DB (rowCount 1 — inserting path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call with a 1-based chunk index
      await repo.createExportArtifactGroupArtifact(GROUP_ID, ARTIFACT_ID, 2);

      // Step 4: Verify the ON CONFLICT clause and the bound link columns
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('ON CONFLICT');
      expect(sqlText).to.include('DO NOTHING');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.deep.equal([GROUP_ID, ARTIFACT_ID, 2]);
    });

    it('does not throw when rowCount is 0 (retry-idempotent conflict no-op)', async () => {
      // Verifies: a retried part insert on an existing link (rowCount 0) is a valid silent no-op

      // Step 1: Setup mock DB to return zero rows (conflict path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call createExportArtifactGroupArtifact
      const result = await repo.createExportArtifactGroupArtifact(GROUP_ID, ARTIFACT_ID, 1);

      // Step 4: Verify it resolved without throwing
      expect(result).to.be.undefined;
      expect(sqlStub).to.have.been.calledOnce;
    });
  });

  describe('listDownloadVersionExports', () => {
    it('returns rows from the paginated list query', async () => {
      // Verifies: the repository returns the parsed query rows without service-layer shaping.

      const row = createMockDownloadVersionExportListRow();
      const knexStub = sinon.stub().resolves(mockQueryResult([row]));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadVersionExportRepository(mockDBConnection);

      const result = await repo.listDownloadVersionExports(DOWNLOAD_ID, { page: 1, limit: 10 });

      expect(knexStub).to.have.been.calledOnce;
      expect(result).to.eql([row]);
    });
  });

  describe('listDownloadVersionExportsCount', () => {
    it('returns the export count for a download', async () => {
      const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 2 }]));
      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const repo = new DownloadVersionExportRepository(mockDBConnection);
      const result = await repo.listDownloadVersionExportsCount(DOWNLOAD_ID);

      expect(knexStub).to.have.been.calledOnce;
      expect(result).to.equal(2);
    });
  });

  describe('listDownloadVersionExportsByDownloadIds', () => {
    it('short-circuits to [] without hitting the DB when no ids are supplied', async () => {
      // Verifies: an empty id array avoids a `= ANY('{}')` no-op round-trip entirely

      // Step 1: Setup an un-resolved sql stub to detect any unexpected call
      const sqlStub = sinon.stub();
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call with an empty array
      const result = await repo.listDownloadVersionExportsByDownloadIds([]);

      // Step 4: Verify the [] short-circuit and that the DB was never queried
      expect(result).to.deep.equal([]);
      expect(sqlStub.notCalled).to.be.true;
      expect(sqlStub.callCount).to.equal(0);
    });

    it('SQL uses ANY() over the id array and orders by download_id ASC then create_date DESC', async () => {
      // Verifies: the batch variant filters with = ANY(...) and orders for deterministic per-download slicing

      // Step 1: Setup mock DB to return an empty row set
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call with a non-empty id array
      const ids = [DOWNLOAD_ID, 'aaaa0000-0000-0000-0000-000000000002'];
      await repo.listDownloadVersionExportsByDownloadIds(ids);

      // Step 4: Verify the ANY() filter and the deterministic ordering
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('ANY(');
      expect(sqlText).to.match(/ORDER BY[\s\S]*dv\.download_id[\s\S]*ASC[\s\S]*de\.create_date[\s\S]*DESC/i);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues[0]).to.deep.equal(ids);
    });
  });

  describe('listExportArtifactGroupArtifactsByExportId', () => {
    it('JOINs artifact, filters a.byte_size IS NOT NULL, orders by chunk_id ASC, binds exportId', async () => {
      // Verifies: parts are joined to artifact for file metadata, pending artifacts are excluded, parts ordered by index

      // Step 1: Setup mock DB to return an empty row set
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call listExportArtifactGroupArtifactsByExportId
      await repo.listExportArtifactGroupArtifactsByExportId(EXPORT_ID);

      // Step 4: Verify the artifact join, the byte_size filter, the ordering, and the bound export id
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.match(/JOIN\s+artifact/i);
      expect(sqlText).to.include('a.byte_size IS NOT NULL');
      expect(sqlText).to.match(/ORDER BY[\s\S]*dvea\.chunk_id[\s\S]*ASC/i);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(EXPORT_ID);
    });
  });

  describe('findExportArtifactGroupById', () => {
    it('SELECTs config/config_hash and binds the group id', async () => {
      // Verifies: the by-id lookup surfaces the inline config + its hash so callers see the full recipe

      // Step 1: Setup mock DB to return one group
      const sqlStub = sinon.stub().resolves(mockQueryResult([createMockExportArtifactGroup()], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call findExportArtifactGroupById
      await repo.findExportArtifactGroupById(GROUP_ID);

      // Step 4: Verify the SELECT now includes config/config_hash and binds the group id
      const sqlText = sqlStub.firstCall.args[0].text;
      const selectClause = sqlText.slice(sqlText.indexOf('SELECT'), sqlText.indexOf('FROM'));
      expect(selectClause).to.include('config');
      expect(selectClause).to.include('config_hash');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(GROUP_ID);
    });
  });

  describe('getExportArtifactGroupById', () => {
    it('throws ApiNotFoundError when no group matches', async () => {
      // Verifies: the get* variant maps an empty result to a 404-mapping ApiNotFoundError

      // Step 1: Setup mock DB to return no rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiNotFoundError
      try {
        await repo.getExportArtifactGroupById(GROUP_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Export artifact group not found');
      }
    });
  });

  describe('getDownloadVersionExportById', () => {
    it('the find SQL JOINs the group and the version→download chain', async () => {
      // Verifies: the full-record lookup reaches lifecycle fields via the group and download_id via the version chain

      // Step 1: Setup mock DB to return one full export record (thin row + group lifecycle + download_id)
      const group = createMockExportArtifactGroup();
      const fullRecord = {
        ...createMockDownloadVersionExport(),
        download_id: DOWNLOAD_ID,
        status: group.status,
        started_at: group.started_at,
        completed_at: group.completed_at,
        error_message: group.error_message
      };
      const sqlStub = sinon.stub().resolves(mockQueryResult([fullRecord], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call getDownloadVersionExportById
      await repo.getDownloadVersionExportById(EXPORT_ID);

      // Step 4: Verify the joins to the group and to the version→download chain
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_version_export_artifact_group');
      expect(sqlText).to.include('download_version dv');
      expect(sqlText).to.include('dv.download_id');
    });

    it('throws ApiNotFoundError when no export matches', async () => {
      // Verifies: the get* variant maps an empty result to a 404-mapping ApiNotFoundError

      // Step 1: Setup mock DB to return no rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiNotFoundError
      try {
        await repo.getDownloadVersionExportById(EXPORT_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Download version export not found');
      }
    });
  });
});

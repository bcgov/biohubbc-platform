import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { createMockDownloadVersionExport, createMockExportArtifactGroup } from '../../__mocks__/download';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
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

const groupPayload: CreateExportArtifactGroupPayload = {
  downloadVersionId: VERSION_ID,
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
    it('WHERE filters on all 5 dedupe-key columns plus record_end_date IS NULL', async () => {
      // Verifies: the active-group probe keys on the full partial-unique tuple and excludes ended groups

      // Step 1: Setup mock DB to return no active group
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call findActiveExportArtifactGroup
      await repo.findActiveExportArtifactGroup(VERSION_ID, 'csv', 'per_feature_type', '524288000', 1);

      // Step 4: Verify all 5 key columns plus the active-row filter appear in the WHERE
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('download_version_id');
      expect(sqlText).to.include('format');
      expect(sqlText).to.include('mode');
      expect(sqlText).to.include('max_part_size_bytes');
      expect(sqlText).to.include('exporter_version');
      expect(sqlText).to.include('record_end_date IS NULL');
    });
  });

  describe('createExportArtifactGroup', () => {
    it('SQL is ON CONFLICT … DO NOTHING on the 5 key columns; does not throw on rowCount 0; binds all 5', async () => {
      // Verifies: group materialization is an idempotent upsert that no-ops the racing loser (rowCount 0)

      // Step 1: Setup mock DB to return zero rows (the conflict / loser path)
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call createExportArtifactGroup — must resolve, not throw, on rowCount 0
      const result = await repo.createExportArtifactGroup(groupPayload);
      expect(result).to.be.undefined;

      // Step 4: Verify the partial-unique conflict target and all 5 bound key columns
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include(
        'ON CONFLICT (download_version_id, format, mode, max_part_size_bytes, exporter_version) WHERE record_end_date IS NULL DO NOTHING'
      );

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(VERSION_ID);
      expect(sqlValues).to.include('csv');
      expect(sqlValues).to.include('per_feature_type');
      expect(sqlValues).to.include('524288000');
      expect(sqlValues).to.include(1);
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

  describe('listDownloadVersionExportsByDownloadId', () => {
    it('JOINs the group for status, computes part_count, walks export→version→download, orders by create_date DESC', async () => {
      // Verifies: the single-download list surfaces group status + a derived part_count and resolves download_id

      // Step 1: Setup mock DB to return an empty row set
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionExportRepository(mockDBConnection);

      // Step 3: Call listDownloadVersionExportsByDownloadId
      await repo.listDownloadVersionExportsByDownloadId(DOWNLOAD_ID);

      // Step 4: Verify the joins, the COUNT-derived part_count, and the ordering
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('g.status');
      expect(sqlText).to.include('COUNT');
      expect(sqlText).to.include('part_count');
      expect(sqlText).to.include('dv.download_id');
      expect(sqlText).to.match(/ORDER BY[\s\S]*de\.create_date[\s\S]*DESC/i);

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DOWNLOAD_ID);
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

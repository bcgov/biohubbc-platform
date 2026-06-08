import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, mockQueryResult } from '../../__mocks__/db';
import { createMockDownloadVersion } from '../../__mocks__/download';
import { ApiExecuteSQLError, ApiNotFoundError } from '../../errors/api-error';
import { DownloadStatusEnum } from '../../models/download-status';
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

  describe('setCurrentDownloadVersion', () => {
    it('UPDATEs download.current_download_version_id', async () => {
      // Verifies: the pointer flip targets download.current_download_version_id

      // Step 1: Setup mock DB to report one updated row
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call setCurrentDownloadVersion
      await repo.setCurrentDownloadVersion(DOWNLOAD_ID, VERSION_ID);

      // Step 4: Verify the UPDATE target column
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('UPDATE download');
      expect(sqlText).to.include('current_download_version_id');
    });

    it('throws ApiExecuteSQLError when rowCount is not 1', async () => {
      // Verifies: an UPDATE that matched no download row is surfaced as an error

      // Step 1: Setup mock DB to report zero updated rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiExecuteSQLError
      try {
        await repo.setCurrentDownloadVersion(DOWNLOAD_ID, VERSION_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiExecuteSQLError);
        expect(err.message).to.equal('Failed to set current download version');
      }
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

  describe('getDownloadVersionById', () => {
    it('throws ApiNotFoundError when no version matches', async () => {
      // Verifies: the get* variant maps an empty result to a 404-mapping ApiNotFoundError

      // Step 1: Setup mock DB to return no rows
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3 + 4: Call and assert it rejects with ApiNotFoundError
      try {
        await repo.getDownloadVersionById(VERSION_ID);
        expect.fail('Expected error');
      } catch (err: any) {
        expect(err).to.be.instanceOf(ApiNotFoundError);
        expect(err.message).to.equal('Download version not found');
      }
    });
  });

  describe('listDownloadVersionArtifactsByDownloadVersionId', () => {
    it('JOINs artifact, filters record_end_date IS NULL, and binds versionId', async () => {
      // Verifies: the active-artifact lookup joins artifact for object_key and excludes ended links

      // Step 1: Setup mock DB to return an empty row set
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository with mocked connection
      const repo = new DownloadVersionRepository(mockDBConnection);

      // Step 3: Call the list method
      await repo.listDownloadVersionArtifactsByDownloadVersionId(VERSION_ID);

      // Step 4: Verify the JOIN, the active-row filter, and the bound version id
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.match(/JOIN\s+artifact/i);
      expect(sqlText).to.include('record_end_date IS NULL');

      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(VERSION_ID);
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
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

  describe('createDownloadFeatures', () => {
    it('inserts join table rows for each feature ID using unnest', async () => {
      // Verifies: SQL uses parameterized unnest with the feature ID array

      // Step 1: Setup sql stub to capture the query
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 3));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call with multiple feature IDs
      await repo.createDownloadFeatures('aaaa0000-0000-0000-0000-000000000001', [10, 20, 30]);

      // Step 4: Verify sql uses unnest and passes parameters correctly
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('unnest');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.deep.include([10, 20, 30]);
    });

    it('handles single feature ID', async () => {
      // Verifies: Works correctly with a single feature ID

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call with a single feature ID
      await repo.createDownloadFeatures('aaaa0000-0000-0000-0000-000000000001', [10]);

      // Step 4: Verify sql was called with the single value
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000001');
      expect(sqlValues).to.deep.include([10]);
    });
  });

  describe('updateDownloadStatus', () => {
    it('updates status with metadata', async () => {
      // Verifies: SQL is called with correct status and metadata fields

      // Step 1: Setup sql stub to capture the query
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call updateDownloadStatus with metadata
      await repo.updateDownloadStatus('aaaa0000-0000-0000-0000-000000000001', DownloadStatusEnum.READY, {
        completed_at: '2025-01-01T00:01:00Z'
      });

      // Step 4: Verify sql was called with the correct parameters
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.READY);
      expect(sqlValues).to.include('2025-01-01T00:01:00Z');
    });

    it('updates status without metadata', async () => {
      // Verifies: SQL is called with null metadata fields when metadata is omitted

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call updateDownloadStatus without metadata
      await repo.updateDownloadStatus('aaaa0000-0000-0000-0000-000000000001', DownloadStatusEnum.FAILED);

      // Step 4: Verify sql was called with the correct status
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.FAILED);
    });
  });

  describe('createDownload', () => {
    it('includes system_user_id in INSERT SQL', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownload(null, null, undefined, 42);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('system_user_id');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(42);
    });

    it('passes null system_user_id for anonymous downloads', async () => {
      const sqlStub = sinon
        .stub()
        .resolves(mockQueryResult([{ download_id: 'aaaa0000-0000-0000-0000-000000000001' }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.createDownload(null, null, undefined, null);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(null);
    });
  });

  describe('getDownloadsByTeamMembership', () => {
    it('includes owner path checking system_user_id', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.getDownloadsByTeamMembership(123);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('system_user_id');
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(123);
    });
  });

  describe('isUserAuthorizedForDownload', () => {
    it('includes owner check for system_user_id', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ authorized: true }], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      await repo.isUserAuthorizedForDownload('aaaa0000-0000-0000-0000-000000000001', 42);

      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      // Should check owner path (system_user_id on download table itself)
      expect(sqlText).to.include('d.system_user_id');
    });
  });

  describe('claimDownload', () => {
    it('returns true when claim succeeds (rowCount = 1)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.claimDownload('aaaa0000-0000-0000-0000-000000000001', 42);

      expect(result).to.be.true;
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('system_user_id');
      expect(sqlText).to.include('system_user_id IS NULL');
      expect(sqlText).to.include('team_id IS NULL');
    });

    it('returns false when download is already claimed (rowCount = 0)', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      const repo = new DownloadRepository(mockDBConnection);
      const result = await repo.claimDownload('aaaa0000-0000-0000-0000-000000000001', 42);

      expect(result).to.be.false;
    });
  });

  describe('getDownloadFeatureSummaries', () => {
    it('uses pre-computed data_byte_size directly', async () => {
      // Verifies: SQL uses data_byte_size column directly (no artifact JOIN needed)

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Call method
      const repo = new DownloadRepository(mockDBConnection);
      await repo.getDownloadFeatureSummaries(
        'aaaa0000-0000-0000-0000-000000000001',
        'bbbb0000-0000-0000-0000-000000000010'
      );

      // Step 3: Verify SQL uses pre-computed column directly
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('data_byte_size');
      expect(sqlText).to.include('estimated_byte_size');
    });

    it('passes downloadId and teamId as parameters', async () => {
      // Verifies: Correct parameters are passed to the SQL query

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 0));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Call method
      const repo = new DownloadRepository(mockDBConnection);
      await repo.getDownloadFeatureSummaries(
        'aaaa0000-0000-0000-0000-000000000005',
        'bbbb0000-0000-0000-0000-000000000042'
      );

      // Step 3: Verify parameters
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include('aaaa0000-0000-0000-0000-000000000005');
      expect(sqlValues).to.include('bbbb0000-0000-0000-0000-000000000042');
    });
  });
});

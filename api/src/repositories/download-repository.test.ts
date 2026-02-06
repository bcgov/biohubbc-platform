import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { DownloadStatusEnum } from '../models/download-status';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { DownloadRepository } from './download-repository';

chai.use(sinonChai);

describe('DownloadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createDownloadFeatures', () => {
    it('inserts join table rows for each feature ID', async () => {
      // Verifies: SQL is called with correctly constructed VALUES for multiple feature IDs

      // Step 1: Setup sql stub to capture the query
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 3));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call with multiple feature IDs
      await repo.createDownloadFeatures(1, [10, 20, 30]);

      // Step 4: Verify sql was called and the constructed VALUES contain all IDs
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('(1, 10)');
      expect(sqlText).to.include('(1, 20)');
      expect(sqlText).to.include('(1, 30)');
    });

    it('handles single feature ID', async () => {
      // Verifies: Works correctly with a single feature ID (no trailing comma)

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call with a single feature ID
      await repo.createDownloadFeatures(1, [10]);

      // Step 4: Verify sql was called with the single value
      expect(sqlStub).to.have.been.calledOnce;
      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('(1, 10)');
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
      await repo.updateDownloadStatus(1, DownloadStatusEnum.READY, {
        s3_key: 'downloads/file.zip',
        file_name: 'file.zip',
        file_size_bytes: 2048
      });

      // Step 4: Verify sql was called with the correct parameters
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.READY);
      expect(sqlValues).to.include('downloads/file.zip');
      expect(sqlValues).to.include('file.zip');
      expect(sqlValues).to.include(2048);
    });

    it('updates status without metadata', async () => {
      // Verifies: SQL is called with null metadata fields when metadata is omitted

      // Step 1: Setup sql stub
      const sqlStub = sinon.stub().resolves(mockQueryResult([], 1));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });

      // Step 2: Create repository
      const repo = new DownloadRepository(mockDBConnection);

      // Step 3: Call updateDownloadStatus without metadata
      await repo.updateDownloadStatus(1, DownloadStatusEnum.FAILED);

      // Step 4: Verify sql was called with the correct status
      expect(sqlStub).to.have.been.calledOnce;
      const sqlValues = sqlStub.firstCall.args[0].values;
      expect(sqlValues).to.include(DownloadStatusEnum.FAILED);
    });
  });
});

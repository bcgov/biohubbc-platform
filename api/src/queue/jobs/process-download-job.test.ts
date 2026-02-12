import { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import * as db from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadService } from '../../services/download-service';
import { getMockDBConnection } from '../../__mocks__/db';
import {
  IProcessDownloadJobData,
  processDownloadFailedHandler,
  processDownloadJobHandler
} from './process-download-job';

describe('process-download-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('processDownloadJobHandler', () => {
    const createMockJob = (downloadId: string, systemUserId: number | null, jobId = 'test-job-id') =>
      ({
        id: jobId,
        name: 'process-download',
        data: { downloadId, systemUserId }
      } as PgBoss.Job<IProcessDownloadJobData>);

    it('calls each phase with correct downloadId', async () => {
      // Verifies: Handler orchestrates plan → process → finalize with correct downloadId

      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      const planStub = sinon.stub(DownloadService.prototype, 'planDownloadIfNeeded').resolves();
      sinon.stub(DownloadService.prototype, 'getFragmentsToProcess').resolves([]);
      const finalizeStub = sinon.stub(DownloadService.prototype, 'finalizeDownload').resolves();

      const mockJobs = [createMockJob('aaaa0000-0000-0000-0000-000000000123', 456, 'job-abc')];
      await processDownloadJobHandler(mockJobs);

      expect(planStub.calledOnce).to.be.true;
      expect(planStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123');
      expect(finalizeStub.calledOnce).to.be.true;
      expect(finalizeStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123');
    });

    it('rolls back and throws error on failure without updating status to failed', async () => {
      // Verifies: On error, transaction is rolled back and error is re-thrown for pg-boss retry

      const mockDBConnection = getMockDBConnection();
      const testError = new Error('Processing error');

      const rollbackStub = sinon.stub().resolves();
      const releaseStub = sinon.stub();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = releaseStub;

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      // Fail during planning phase
      sinon.stub(DownloadService.prototype, 'planDownloadIfNeeded').rejects(testError);

      const updateStatusStub = sinon.stub(DownloadService.prototype, 'updateDownloadStatus').resolves();

      const mockJobs = [createMockJob('aaaa0000-0000-0000-0000-000000000123', 456)];

      try {
        await processDownloadJobHandler(mockJobs);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
        expect(rollbackStub.called).to.be.true;
        expect(releaseStub.called).to.be.true;
        expect(updateStatusStub.called).to.be.false;
      }
    });
  });

  describe('processDownloadFailedHandler', () => {
    const createMockFailedJob = (
      downloadId: string,
      systemUserId: number | null,
      jobId = 'dlq-job-id',
      output?: unknown
    ) =>
      ({
        id: jobId,
        name: '__state__completed__process-download',
        data: { downloadId, systemUserId },
        output
      } as PgBoss.JobWithMetadata<IProcessDownloadJobData>);

    it('updates status to failed using downloadId', async () => {
      // Verifies: DLQ handler uses downloadId to update status to failed

      // Step 1: Setup mock DB connection
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      // Step 2: Stub updateDownloadStatus
      const updateStatusByIdStub = sinon.stub(DownloadService.prototype, 'updateDownloadStatus').resolves();

      // Step 3: Call handler with failed job
      const mockJobs = [createMockFailedJob('aaaa0000-0000-0000-0000-000000000123', 456, 'dlq-job-id')];
      await processDownloadFailedHandler(mockJobs);

      // Step 4: Verify updateDownloadStatus was called with correct args
      expect(updateStatusByIdStub.calledOnce).to.be.true;
      expect(updateStatusByIdStub.firstCall.args[0]).to.equal('aaaa0000-0000-0000-0000-000000000123'); // downloadId
      expect(updateStatusByIdStub.firstCall.args[1]).to.equal(DownloadStatusEnum.FAILED);
    });

    it('passes string error from job output when available', async () => {
      // Verifies: Handler extracts string error from job output

      // Step 1: Setup mock DB connection
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      // Step 2: Stub updateDownloadStatus
      const updateStatusByIdStub = sinon.stub(DownloadService.prototype, 'updateDownloadStatus').resolves();

      // Step 3: Call handler with job that has string output
      const errorOutput = 'Database connection failed';
      const mockJobs = [createMockFailedJob('aaaa0000-0000-0000-0000-000000000123', 456, 'dlq-job-id', errorOutput)];
      await processDownloadFailedHandler(mockJobs);

      // Step 4: Verify error was passed in metadata
      expect(updateStatusByIdStub.firstCall.args[2]).to.deep.equal({ error: 'Database connection failed' });
    });

    it('uses default error message when job output is not a string', async () => {
      // Verifies: Handler uses default message when output is null/object

      // Step 1: Setup mock DB connection
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      mockDBConnection.commit = sinon.stub().resolves();
      mockDBConnection.release = sinon.stub();

      sinon.stub(db, 'getAPIUserDBConnection').returns(mockDBConnection);

      // Step 2: Stub updateDownloadStatus
      const updateStatusByIdStub = sinon.stub(DownloadService.prototype, 'updateDownloadStatus').resolves();

      // Step 3: Call handler with job that has non-string output
      const mockJobs = [
        createMockFailedJob('aaaa0000-0000-0000-0000-000000000123', 456, 'dlq-job-id', { some: 'object' })
      ];
      await processDownloadFailedHandler(mockJobs);

      // Step 4: Verify default error message was used
      expect(updateStatusByIdStub.firstCall.args[2]).to.deep.equal({
        error: 'Job failed after all retries'
      });
    });
  });
});

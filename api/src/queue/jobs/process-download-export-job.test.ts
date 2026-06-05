import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { DownloadExportRecord } from '../../models/download-export';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadExportRepository } from '../../repositories/download/download-export-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import {
  IProcessDownloadExportJobData,
  processDownloadExportFailedHandler,
  processDownloadExportJobHandler
} from './process-download-export-job';

chai.use(sinonChai);

describe('process-download-export-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (downloadExportId: string, jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'process-download-export',
      data: { downloadExportId }
    } as PgBoss.Job<IProcessDownloadExportJobData>);

  /**
   * Stubs getAPIUserDBConnection and returns a mock connection that supports
   * open/commit/rollback/release for withConnection usage.
   */
  const setupMockConnection = () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    mockDBConnection.commit = sinon.stub().resolves();
    mockDBConnection.rollback = sinon.stub().resolves();
    mockDBConnection.release = sinon.stub();
    sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
    return mockDBConnection;
  };

  const createMockExportRecord = (overrides?: Partial<DownloadExportRecord>): DownloadExportRecord => ({
    download_export_id: 'exp-1',
    download_id: 'dl-1',
    format: 'csv',
    status: DownloadStatusEnum.PENDING,
    mode: 'per_feature_type',
    max_part_size_bytes: '524288000',
    started_at: null,
    completed_at: null,
    error_message: null,
    ...overrides
  });

  describe('processDownloadExportJobHandler', () => {
    it('transitions pending → processing → ready by delegating to runExport', async () => {
      setupMockConnection();

      sinon.stub(DownloadExportRepository.prototype, 'findDownloadExportById').resolves(createMockExportRecord());

      const runExportStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExport').resolves();

      await processDownloadExportJobHandler([createMockJob('exp-1')]);

      expect(runExportStub).to.have.been.calledOnce;
    });

    it('calls runExport with the export ID extracted from job data', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
        .resolves(createMockExportRecord({ download_export_id: 'exp-42' }));

      const runExportStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExport').resolves();

      await processDownloadExportJobHandler([createMockJob('exp-42')]);

      expect(runExportStub).to.have.been.calledOnceWith('exp-42');
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.DOWNLOADED, DownloadStatusEnum.FAILED]) {
      it(`skips silently when status is terminal (${terminalStatus})`, async () => {
        setupMockConnection();

        sinon
          .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
          .resolves(createMockExportRecord({ status: terminalStatus }));

        const runExportStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExport').resolves();

        await processDownloadExportJobHandler([createMockJob('exp-1')]);

        expect(runExportStub).to.not.have.been.called;
      });
    }

    it('throws when findDownloadExportById returns null', async () => {
      setupMockConnection();

      sinon.stub(DownloadExportRepository.prototype, 'findDownloadExportById').resolves(null);

      const runExportStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExport').resolves();

      try {
        await processDownloadExportJobHandler([createMockJob('exp-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal('Download export exp-1 not found');
      }

      expect(runExportStub).to.not.have.been.called;
    });

    it('throws when status is unexpected (neither start nor terminal)', async () => {
      setupMockConnection();

      sinon
        .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
        .resolves(createMockExportRecord({ status: 'bogus' as DownloadStatusEnum }));

      const runExportStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExport').resolves();

      try {
        await processDownloadExportJobHandler([createMockJob('exp-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.contain("unexpected status 'bogus'");
      }

      expect(runExportStub).to.not.have.been.called;
    });

    it('propagates error from runExport without swallowing (pg-boss must see the throw to retry)', async () => {
      setupMockConnection();

      sinon.stub(DownloadExportRepository.prototype, 'findDownloadExportById').resolves(createMockExportRecord());

      const testError = new Error('S3 upload failed');
      sinon.stub(DownloadExportPipelineService.prototype, 'runExport').rejects(testError);

      try {
        await processDownloadExportJobHandler([createMockJob('exp-1')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }
    });
  });

  describe('processDownloadExportFailedHandler', () => {
    const createMockFailedJob = (downloadExportId: string, jobId = 'dlq-job-id', output?: unknown) =>
      ({
        id: jobId,
        name: '__state__completed__process-download-export',
        data: { downloadExportId },
        output
      } as PgBoss.JobWithMetadata<IProcessDownloadExportJobData>);

    const setupDLQMocks = () => {
      const mockDBConnection = getMockDBConnection();
      mockDBConnection.open = sinon.stub().resolves();
      const commitStub = sinon.stub().resolves();
      const rollbackStub = sinon.stub().resolves();
      mockDBConnection.commit = commitStub;
      mockDBConnection.rollback = rollbackStub;
      mockDBConnection.release = sinon.stub();

      sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);
      return { commitStub, rollbackStub };
    };

    it('transitions to failed with error metadata for a string job output', async () => {
      setupDLQMocks();

      sinon
        .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();

      await processDownloadExportFailedHandler([createMockFailedJob('exp-1', 'dlq-job-id', 'explicit error message')]);

      expect(transitionStub).to.have.been.calledOnce;
      expect(transitionStub.firstCall.args[0]).to.equal('exp-1');
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.FAILED);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);
      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'explicit error message' });
    });

    it('uses generic error message when job output is not a string', async () => {
      setupDLQMocks();

      sinon
        .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();

      await processDownloadExportFailedHandler([createMockFailedJob('exp-1', 'dlq-job-id', { whatever: 'obj' })]);

      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'Job failed after all retries' });
    });

    it('uses generic error message when job output is undefined', async () => {
      setupDLQMocks();

      sinon
        .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PROCESSING }));

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();

      await processDownloadExportFailedHandler([createMockFailedJob('exp-1', 'dlq-job-id', undefined)]);

      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'Job failed after all retries' });
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.DOWNLOADED, DownloadStatusEnum.FAILED]) {
      it(`skips silently when the export is already in terminal status (${terminalStatus})`, async () => {
        const { commitStub, rollbackStub } = setupDLQMocks();

        sinon
          .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
          .resolves(createMockExportRecord({ status: terminalStatus }));

        const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();

        await processDownloadExportFailedHandler([createMockFailedJob('exp-1', 'dlq-job-id', 'anything')]);

        expect(transitionStub).to.not.have.been.called;
        expect(commitStub).to.have.been.calledOnce;
        expect(rollbackStub).to.not.have.been.called;
      });
    }

    it('skips silently when the export is not found', async () => {
      const { commitStub, rollbackStub } = setupDLQMocks();

      sinon.stub(DownloadExportRepository.prototype, 'findDownloadExportById').resolves(null);

      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').resolves();

      await processDownloadExportFailedHandler([createMockFailedJob('exp-1', 'dlq-job-id', 'anything')]);

      expect(transitionStub).to.not.have.been.called;
      expect(commitStub).to.have.been.calledOnce;
      expect(rollbackStub).to.not.have.been.called;
    });

    it('rethrows unexpected errors from transitionExportStatus', async () => {
      const { commitStub, rollbackStub } = setupDLQMocks();

      sinon
        .stub(DownloadExportRepository.prototype, 'findDownloadExportById')
        .resolves(createMockExportRecord({ status: DownloadStatusEnum.PROCESSING }));

      const testError = new Error('unexpected');
      sinon.stub(DownloadExportPipelineService.prototype, 'transitionExportStatus').rejects(testError);

      try {
        await processDownloadExportFailedHandler([createMockFailedJob('exp-1', 'dlq-job-id', 'anything')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      expect(rollbackStub).to.have.been.calledOnce;
      expect(commitStub).to.not.have.been.called;
    });
  });
});

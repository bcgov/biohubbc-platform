import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockExportArtifactGroup } from '../../__mocks__/download';
import * as db from '../../database/db';
import { DownloadStatusEnum } from '../../models/download-status';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { DownloadExportPipelineService } from '../../services/download/download-export-pipeline-service';
import { IProcessDownloadVersionExportJobData } from '../publisher';
import {
  processDownloadVersionExportFailedHandler,
  processDownloadVersionExportJobHandler
} from './process-download-version-export-job';

chai.use(sinonChai);

const GROUP_ID = 'cccc0000-0000-0000-0000-000000000001';

describe('process-download-version-export-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (downloadVersionExportArtifactGroupId: string, jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'process-download-version-export',
      data: { downloadVersionExportArtifactGroupId }
    } as PgBoss.Job<IProcessDownloadVersionExportJobData>);

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

  describe('processDownloadVersionExportJobHandler', () => {
    it('delegates packaging to runExportGroup when the group is in a start status', async () => {
      // Verifies: a pending group is handed off to the pipeline's runExportGroup.

      // Step 1: Stub the connection seam + the up-front group guard fetch
      setupMockConnection();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PENDING }));

      // Step 2: Stub the pipeline entry point
      const runExportGroupStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExportGroup').resolves();

      // Step 3: Run the handler
      await processDownloadVersionExportJobHandler([createMockJob(GROUP_ID)]);

      // Step 4: Verify the pipeline was invoked
      expect(runExportGroupStub).to.have.been.calledOnce;
    });

    it('calls runExportGroup with the group id extracted from job data', async () => {
      // Verifies: the handler pulls downloadVersionExportArtifactGroupId out of the payload and
      // forwards it to the pipeline.

      // Step 1: Stub the connection + group guard
      setupMockConnection();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PENDING }));

      // Step 2: Stub the pipeline
      const runExportGroupStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExportGroup').resolves();

      // Step 3: Run with a specific group id
      await processDownloadVersionExportJobHandler([createMockJob('cccc0000-0000-0000-0000-000000000042')]);

      // Step 4: Verify the id was forwarded
      expect(runExportGroupStub).to.have.been.calledOnceWith('cccc0000-0000-0000-0000-000000000042');
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.DOWNLOADED, DownloadStatusEnum.FAILED]) {
      it(`skips silently when status is terminal (${terminalStatus})`, async () => {
        // Verifies: a terminal group short-circuits — pg-boss re-firing a finished job is a no-op.

        // Step 1: Stub the connection + a terminal group
        setupMockConnection();
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
          .resolves(createMockExportArtifactGroup({ status: terminalStatus }));

        // Step 2: Stub the pipeline to detect any (wrong) call
        const runExportGroupStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExportGroup').resolves();

        // Step 3: Run the handler
        await processDownloadVersionExportJobHandler([createMockJob(GROUP_ID)]);

        // Step 4: The pipeline must not run for a terminal group
        expect(runExportGroupStub).to.not.have.been.called;
      });
    }

    it('throws when findExportArtifactGroupById returns null', async () => {
      // Verifies: a missing group surfaces as an explicit throw (routing the job to the DLQ).

      // Step 1: Stub the connection + a missing group
      setupMockConnection();
      sinon.stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById').resolves(null);

      // Step 2: Stub the pipeline to detect any (wrong) call
      const runExportGroupStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExportGroup').resolves();

      // Step 3: Run — expect the not-found throw
      try {
        await processDownloadVersionExportJobHandler([createMockJob(GROUP_ID)]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.equal(`Export artifact group ${GROUP_ID} not found`);
      }

      // Step 4: The pipeline never ran
      expect(runExportGroupStub).to.not.have.been.called;
    });

    it('throws when status is unexpected (neither start nor terminal)', async () => {
      // Verifies: an unexpected status throws so the job lands in the DLQ for triage.

      // Step 1: Stub the connection + a bogus-status group
      setupMockConnection();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: 'bogus' as DownloadStatusEnum }));

      // Step 2: Stub the pipeline to detect any (wrong) call
      const runExportGroupStub = sinon.stub(DownloadExportPipelineService.prototype, 'runExportGroup').resolves();

      // Step 3: Run — expect the unexpected-status throw
      try {
        await processDownloadVersionExportJobHandler([createMockJob(GROUP_ID)]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect((error as Error).message).to.contain("unexpected status 'bogus'");
      }

      // Step 4: The pipeline never ran
      expect(runExportGroupStub).to.not.have.been.called;
    });

    it('propagates error from runExportGroup without swallowing (pg-boss must see the throw to retry)', async () => {
      // Verifies: a pipeline error bubbles up unchanged so pg-boss retries / DLQs it.

      // Step 1: Stub the connection + a start-status group
      setupMockConnection();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PENDING }));

      // Step 2: Stub the pipeline to reject
      const testError = new Error('S3 upload failed');
      sinon.stub(DownloadExportPipelineService.prototype, 'runExportGroup').rejects(testError);

      // Step 3: Run — expect the same error instance to bubble up
      try {
        await processDownloadVersionExportJobHandler([createMockJob(GROUP_ID)]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }
    });
  });

  describe('processDownloadVersionExportFailedHandler', () => {
    const createMockFailedJob = (
      downloadVersionExportArtifactGroupId: string,
      jobId = 'dlq-job-id',
      output?: unknown
    ) =>
      ({
        id: jobId,
        name: '__state__completed__process-download-version-export',
        data: { downloadVersionExportArtifactGroupId },
        output
      } as PgBoss.JobWithMetadata<IProcessDownloadVersionExportJobData>);

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

    it('transitions the group to failed with error metadata for a string job output', async () => {
      // Verifies: a string job output is passed through as the error metadata, and the failed
      // transition targets the GROUP with the PENDING/PROCESSING allowed-status set.

      // Step 1: Stub the connection + a processing group
      setupDLQMocks();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PROCESSING }));

      // Step 2: Stub the transition
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();

      // Step 3: Run the DLQ handler with an explicit error string
      await processDownloadVersionExportFailedHandler([
        createMockFailedJob(GROUP_ID, 'dlq-job-id', 'explicit error message')
      ]);

      // Step 4: Verify the transition params the handler decided to pass
      expect(transitionStub).to.have.been.calledOnce;
      expect(transitionStub.firstCall.args[0]).to.equal(GROUP_ID);
      expect(transitionStub.firstCall.args[1]).to.equal(DownloadStatusEnum.FAILED);
      expect(transitionStub.firstCall.args[2]).to.deep.equal([
        DownloadStatusEnum.PENDING,
        DownloadStatusEnum.PROCESSING
      ]);
      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'explicit error message' });
    });

    it('uses generic error message when job output is not a string', async () => {
      // Verifies: the else branch of the typeof check — a non-string output yields the default message.

      // Step 1: Stub the connection + a processing group
      setupDLQMocks();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PROCESSING }));

      // Step 2: Stub the transition
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();

      // Step 3: Run with an object output
      await processDownloadVersionExportFailedHandler([
        createMockFailedJob(GROUP_ID, 'dlq-job-id', { whatever: 'obj' })
      ]);

      // Step 4: Verify the default message was used
      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'Job failed after all retries' });
    });

    it('uses generic error message when job output is undefined', async () => {
      // Verifies: an undefined output also resolves to the default error message.

      // Step 1: Stub the connection + a processing group
      setupDLQMocks();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PROCESSING }));

      // Step 2: Stub the transition
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();

      // Step 3: Run with no output
      await processDownloadVersionExportFailedHandler([createMockFailedJob(GROUP_ID, 'dlq-job-id', undefined)]);

      // Step 4: Verify the default message was used
      expect(transitionStub.firstCall.args[3]).to.deep.equal({ error: 'Job failed after all retries' });
    });

    for (const terminalStatus of [DownloadStatusEnum.READY, DownloadStatusEnum.DOWNLOADED, DownloadStatusEnum.FAILED]) {
      it(`skips silently when the group is already in terminal status (${terminalStatus})`, async () => {
        // Verifies: a terminal group is not re-transitioned, and the connection commits (no rollback).

        // Step 1: Stub the connection + a terminal group
        const { commitStub, rollbackStub } = setupDLQMocks();
        sinon
          .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
          .resolves(createMockExportArtifactGroup({ status: terminalStatus }));

        // Step 2: Stub the transition to detect any (wrong) call
        const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();

        // Step 3: Run the DLQ handler
        await processDownloadVersionExportFailedHandler([createMockFailedJob(GROUP_ID, 'dlq-job-id', 'anything')]);

        // Step 4: No transition, clean commit
        expect(transitionStub).to.not.have.been.called;
        expect(commitStub).to.have.been.calledOnce;
        expect(rollbackStub).to.not.have.been.called;
      });
    }

    it('skips silently when the group is not found', async () => {
      // Verifies: a vanished group is a no-op (find*, not get*) so pg-boss does not loop the DLQ.

      // Step 1: Stub the connection + a missing group
      const { commitStub, rollbackStub } = setupDLQMocks();
      sinon.stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById').resolves(null);

      // Step 2: Stub the transition to detect any (wrong) call
      const transitionStub = sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').resolves();

      // Step 3: Run the DLQ handler
      await processDownloadVersionExportFailedHandler([createMockFailedJob(GROUP_ID, 'dlq-job-id', 'anything')]);

      // Step 4: No transition, clean commit
      expect(transitionStub).to.not.have.been.called;
      expect(commitStub).to.have.been.calledOnce;
      expect(rollbackStub).to.not.have.been.called;
    });

    it('rethrows unexpected errors from transitionGroupStatus and rolls back', async () => {
      // Verifies: an unexpected transition error triggers a rollback and re-throws (no commit).

      // Step 1: Stub the connection + a processing group
      const { commitStub, rollbackStub } = setupDLQMocks();
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'findExportArtifactGroupById')
        .resolves(createMockExportArtifactGroup({ status: DownloadStatusEnum.PROCESSING }));

      // Step 2: Stub the transition to reject
      const testError = new Error('unexpected');
      sinon.stub(DownloadExportPipelineService.prototype, 'transitionGroupStatus').rejects(testError);

      // Step 3: Run — expect the error to bubble up
      try {
        await processDownloadVersionExportFailedHandler([createMockFailedJob(GROUP_ID, 'dlq-job-id', 'anything')]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      // Step 4: Rollback fired, commit did not
      expect(rollbackStub).to.have.been.calledOnce;
      expect(commitStub).to.not.have.been.called;
    });
  });
});

import chai, { expect } from 'chai';
import { describe } from 'mocha';
import PgBoss from 'pg-boss';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import * as db from '../../database/db';
import { DownloadScheduleService } from '../../services/download/download-schedule-service';
import {
  IPollDownloadSchedulesJobData,
  pollDownloadSchedulesFailedHandler,
  pollDownloadSchedulesJobHandler
} from './poll-download-schedules-job';

chai.use(sinonChai);

describe('poll-download-schedules-job', () => {
  afterEach(() => {
    sinon.restore();
  });

  const createMockJob = (jobId = 'test-job-id') =>
    ({
      id: jobId,
      name: 'poll-download-schedules',
      data: {}
    } as PgBoss.Job<IPollDownloadSchedulesJobData>);

  /**
   * Stubs getAPIUserDBConnection and returns the commit/rollback stubs so a test can assert the tick
   * committed (claim + advance + enqueue ride one transaction) or rolled back on failure.
   */
  const setupMockConnection = () => {
    const mockDBConnection = getMockDBConnection();
    mockDBConnection.open = sinon.stub().resolves();
    const commitStub = sinon.stub().resolves();
    const rollbackStub = sinon.stub().resolves();
    mockDBConnection.commit = commitStub;
    mockDBConnection.rollback = rollbackStub;
    mockDBConnection.release = sinon.stub();

    const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection').returns(mockDBConnection);

    return { commitStub, rollbackStub, getConnectionStub };
  };

  describe('pollDownloadSchedulesJobHandler', () => {
    it('runs due schedules once inside a committed connection scope', async () => {
      const { commitStub, rollbackStub } = setupMockConnection();

      const runDueStub = sinon.stub(DownloadScheduleService.prototype, 'runDueSchedules').resolves();

      await pollDownloadSchedulesJobHandler([createMockJob()]);

      expect(runDueStub).to.have.been.calledOnce;
      expect(commitStub).to.have.been.calledOnce;
      expect(rollbackStub).to.not.have.been.called;
    });

    it('runs due schedules once per job for multiple jobs', async () => {
      setupMockConnection();

      const runDueStub = sinon.stub(DownloadScheduleService.prototype, 'runDueSchedules').resolves();

      await pollDownloadSchedulesJobHandler([createMockJob('job-1'), createMockJob('job-2')]);

      expect(runDueStub).to.have.been.calledTwice;
    });

    it('does nothing for an empty batch', async () => {
      const { getConnectionStub } = setupMockConnection();

      const runDueStub = sinon.stub(DownloadScheduleService.prototype, 'runDueSchedules').resolves();

      await pollDownloadSchedulesJobHandler([]);

      expect(runDueStub).to.not.have.been.called;
      expect(getConnectionStub).to.not.have.been.called;
    });

    it('rolls back and propagates the error so pg-boss retries and the tick lands in the DLQ', async () => {
      const { commitStub, rollbackStub } = setupMockConnection();

      const testError = new Error('claim failed');
      sinon.stub(DownloadScheduleService.prototype, 'runDueSchedules').rejects(testError);

      try {
        await pollDownloadSchedulesJobHandler([createMockJob()]);
        expect.fail('Expected an error to be thrown');
      } catch (error) {
        expect(error).to.equal(testError);
      }

      expect(rollbackStub).to.have.been.calledOnce;
      expect(commitStub).to.not.have.been.called;
    });
  });

  describe('pollDownloadSchedulesFailedHandler', () => {
    const createMockFailedJob = (jobId = 'dlq-job-id', output?: unknown) =>
      ({
        id: jobId,
        name: '__state__completed__poll-download-schedules',
        data: {},
        output
      } as PgBoss.JobWithMetadata<IPollDownloadSchedulesJobData>);

    it('logs without throwing and never runs due schedules', async () => {
      const getConnectionStub = sinon.stub(db.dbDependencies, 'getAPIUserDBConnection');
      const runDueStub = sinon.stub(DownloadScheduleService.prototype, 'runDueSchedules').resolves();

      // Must resolve without throwing — re-throwing would loop the dead tick forever.
      await pollDownloadSchedulesFailedHandler([createMockFailedJob('dlq-job-id', 'something went wrong')]);

      expect(runDueStub).to.not.have.been.called;
      expect(getConnectionStub).to.not.have.been.called;
    });
  });
});

import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { JobQueues } from './jobs';
import * as pgBossService from './pg-boss-service';
import { publishExampleJob } from './publisher';

describe('publisher', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('publishExampleJob', () => {
    it('publishes a job to the example queue', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const mockBoss = { send: sendStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const data = { message: 'test message' };
      const jobId = await publishExampleJob(data);

      expect(sendStub.calledOnce).to.be.true;
      expect(sendStub.firstCall.args[0]).to.equal(JobQueues.EXAMPLE);
      expect(sendStub.firstCall.args[1]).to.deep.equal(data);
      expect(jobId).to.equal('test-job-id');
    });

    it('uses default options when none provided', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const mockBoss = { send: sendStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishExampleJob({ message: 'test' });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(2);
      expect(options.retryDelay).to.equal(60);
      expect(options.expireInSeconds).to.equal(60 * 60); // 1 hour
    });

    it('merges provided options with defaults', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const mockBoss = { send: sendStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishExampleJob({ message: 'test' }, { retryLimit: 5, priority: 10 });

      const options = sendStub.firstCall.args[2];
      expect(options.retryLimit).to.equal(5);
      expect(options.retryDelay).to.equal(60); // default
      expect(options.priority).to.equal(10);
    });

    it('returns null when send returns null', async () => {
      const sendStub = sinon.stub().resolves(null);
      const mockBoss = { send: sendStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const jobId = await publishExampleJob({ message: 'test' });

      expect(jobId).to.be.null;
    });

    it('passes singletonKey option for deduplication', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const mockBoss = { send: sendStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await publishExampleJob({ message: 'test' }, { singletonKey: 'unique-key' });

      const options = sendStub.firstCall.args[2];
      expect(options.singletonKey).to.equal('unique-key');
    });

    it('passes startAfter option for delayed jobs', async () => {
      const sendStub = sinon.stub().resolves('test-job-id');
      const mockBoss = { send: sendStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      const startAfter = new Date('2024-01-01T00:00:00Z');
      await publishExampleJob({ message: 'test' }, { startAfter });

      const options = sendStub.firstCall.args[2];
      expect(options.startAfter).to.equal(startAfter);
    });
  });
});

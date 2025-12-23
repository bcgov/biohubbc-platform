import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { JobQueues } from './jobs';
import * as exampleJob from './jobs/example-job';
import * as pgBossService from './pg-boss-service';
import { registerWorkers } from './worker';

describe('worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('registerWorkers', () => {
    it('registers the example job handler with pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const mockBoss = { work: workStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      expect(workStub.calledOnce).to.be.true;
      expect(workStub.firstCall.args[0]).to.equal(JobQueues.EXAMPLE);
    });

    it('configures batchSize for batch processing', async () => {
      const workStub = sinon.stub().resolves();
      const mockBoss = { work: workStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const options = workStub.firstCall.args[1];
      expect(options.batchSize).to.equal(4);
    });

    it('passes the exampleJobHandler to pg-boss', async () => {
      const workStub = sinon.stub().resolves();
      const mockBoss = { work: workStub };

      sinon.stub(pgBossService, 'getPgBoss').returns(mockBoss as any);

      await registerWorkers();

      const handler = workStub.firstCall.args[2];
      expect(handler).to.equal(exampleJob.exampleJobHandler);
    });
  });
});

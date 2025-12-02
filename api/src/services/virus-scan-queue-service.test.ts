import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Queue } from 'bullmq';
import { IVirusScanJob, VIRUS_SCAN_JOB_NAME, VIRUS_SCAN_QUEUE_NAME, VirusScanQueueService } from './virus-scan-queue-service';

chai.use(sinonChai);

describe('VirusScanQueueService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('adds a job to the queue', async () => {
    const addStub = sinon.stub().resolves({ id: '123' });
    const queueStub = { add: addStub } as unknown as Queue;
    const service = new VirusScanQueueService(() => queueStub);

    const payload: IVirusScanJob = { fileKey: 's3://bucket/key' };

    const result = await service.enqueue(payload);

    expect(addStub).to.have.been.calledOnce;
    const [jobName, jobData, jobOptions] = addStub.getCall(0).args;
    expect(jobName).to.equal(VIRUS_SCAN_JOB_NAME);
    expect(jobData).to.eql(payload);
    expect(jobOptions).to.include({ removeOnFail: false });
    expect(result).to.eql({ jobId: '123', queue: VIRUS_SCAN_QUEUE_NAME });
  });

  it('propagates errors from the queue', async () => {
    const queueStub = { add: sinon.stub().rejects(new Error('fail')) } as unknown as Queue;
    const service = new VirusScanQueueService(() => queueStub);

    try {
      await service.enqueue({ fileKey: 'key' });
      expect.fail();
    } catch (error) {
      expect(error).to.be.an.instanceof(Error);
      expect((error as Error).message).to.equal('fail');
    }
  });
});

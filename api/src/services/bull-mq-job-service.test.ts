import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Job, Queue } from 'bullmq';
import { BullMQJobService } from './bull-mq-job-service';

chai.use(sinonChai);

const createJobStub = (overrides: Partial<Job> = {}): Job => {
  const job = {
    id: 'job-1',
    name: 'test-job',
    data: { foo: 'bar' },
    attemptsMade: 0,
    opts: { },
    timestamp: Date.now(),
    processedOn: null,
    finishedOn: null,
    failedReason: null,
    returnvalue: null,
    progress: 0,
    getState: sinon.stub().resolves('waiting'),
    moveToFailed: sinon.stub().resolves()
  };

  return Object.assign(job, overrides) as Job;
};

const createService = (queueStub: Partial<Queue>) =>
  new BullMQJobService({
    queueFactory: () => queueStub as Queue,
    knownQueues: ['submission-jobs']
  });

describe('BullMQJobService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('enqueueJob', () => {
    it('adds a job to the queue', async () => {
      const job = createJobStub({ id: 'new-job', name: 'submission-job' });
      const addStub = sinon.stub().resolves(job);

      const service = createService({ add: addStub });

      const response = await service.enqueueJob(
        'submission-jobs',
        'submission-job',
        { foo: 'bar' },
        { jobId: 'new-job', delayMs: 100 },
      );

      expect(addStub).to.have.been.calledWith(
        'submission-job',
        { foo: 'bar' },
        sinon.match({ jobId: 'new-job', delay: 100 })
      );
      expect(response).to.include({ id: 'new-job', name: 'submission-job', queue: 'submission-jobs' });
    });
  });

  describe('abortJob', () => {
    it('returns false if the job does not exist', async () => {
      const queueStub = {
        getJob: sinon.stub().resolves(null),
        remove: sinon.stub()
      };
      const service = createService(queueStub);

      const result = await service.abortJob('submission-jobs', 'missing');

      expect(result).to.be.false;
      expect(queueStub.remove).to.not.have.been.called;
    });

    it('removes a waiting job', async () => {
      const job = createJobStub({ id: 'waiting' });
      (job.getState as sinon.SinonStub).resolves('waiting');

      const queueStub = {
        getJob: sinon.stub().resolves(job),
        remove: sinon.stub().resolves()
      };
      const service = createService(queueStub);

      const result = await service.abortJob('submission-jobs', 'waiting');

      expect(result).to.be.true;
      expect(queueStub.remove).to.have.been.calledWith('waiting');
      expect((job.moveToFailed as sinon.SinonStub)).to.not.have.been.called;
    });

    it('marks an active job as failed', async () => {
      const job = createJobStub({ id: 'active' });
      (job.getState as sinon.SinonStub).resolves('active');

      const queueStub = {
        getJob: sinon.stub().resolves(job),
        remove: sinon.stub().resolves()
      };
      const service = createService(queueStub);

      const result = await service.abortJob('submission-jobs', 'active');

      expect(result).to.be.true;
      expect(job.moveToFailed as sinon.SinonStub).to.have.been.calledOnce;
      expect(queueStub.remove).to.not.have.been.called;
    });
  });

  describe('getQueueJobStatuses', () => {
    it('returns all job statuses for the queue', async () => {
      const job1 = createJobStub({ id: '1' });
      const job2 = createJobStub({ id: '2' });
      (job2.getState as sinon.SinonStub).resolves('active');

      const queueStub = {
        getJobs: sinon.stub().resolves([job1, job2])
      };
      const service = createService(queueStub);

      const statuses = await service.getQueueJobStatuses('submission-jobs');

      expect(queueStub.getJobs).to.have.been.calledOnce;
      expect(statuses).to.have.length(2);
      expect(statuses.map((job) => job.id)).to.eql(['1', '2']);
    });
  });

  describe('getJobStatus', () => {
    it('returns null when the job is missing', async () => {
      const queueStub = {
        getJob: sinon.stub().resolves(null)
      };
      const service = createService(queueStub);

      const result = await service.getJobStatus('submission-jobs', 'missing');

      expect(result).to.be.null;
    });

    it('returns job detail when it exists', async () => {
      const job = createJobStub({ id: 'existing' });
      const queueStub = { getJob: sinon.stub().resolves(job) };
      const service = createService(queueStub);

      const result = await service.getJobStatus('submission-jobs', 'existing');

      expect(result).to.include({ id: 'existing', queue: 'submission-jobs' });
    });
  });

  describe('listQueues', () => {
    it('returns the configured queues with counts', async () => {
      const queueStub = {
        getJobCounts: sinon.stub().resolves({ waiting: 1, active: 0 }),
        close: sinon.stub().resolves()
      };

      const service = createService(queueStub);
      const queues = await service.listQueues();

      expect(queues).to.eql([{ name: 'submission-jobs', jobCounts: { waiting: 1, active: 0 } }]);
    });
  });
});

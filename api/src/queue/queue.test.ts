import { expect } from 'chai';
import { describe } from 'mocha';
import { ISubmissionJobQueueRecord } from '../repositories/submission-job-queue-repository';
import { Queue } from './queue';
import { QUEUE_DEFAULT_CONCURRENCY, QUEUE_DEFAULT_TIMEOUT } from './queue-scheduler';

describe('Queue', () => {
  it('constructs a new Queue', () => {
    const queue = new Queue();

    expect(queue).not.to.be.null;
    expect(queue).to.be.instanceof(Queue);
  });

  describe('addJobToQueue', () => {
    it('adds 4 items to the queue', () => {
      const queue = new Queue();

      queue._queue.pause();

      expect(queue.getJobQueueLength()).to.equal(0);

      const jobQueueRecordStub = {} as unknown as ISubmissionJobQueueRecord;

      queue.addJobToQueue(jobQueueRecordStub);
      queue.addJobToQueue(jobQueueRecordStub);
      queue.addJobToQueue(jobQueueRecordStub);
      queue.addJobToQueue(jobQueueRecordStub);

      expect(queue.getJobQueueLength()).to.equal(4);
    });
  });

  describe('getJobQueueLength', () => {
    it('returns 0 when no items in the queue', () => {
      const queue = new Queue();

      expect(queue.getJobQueueLength()).to.equal(0);
    });

    it('returns the number of items waiting in the queue', () => {
      const queue = new Queue();

      queue._queue.pause();

      expect(queue.getJobQueueLength()).to.equal(0);

      const jobQueueRecordStub = {} as unknown as ISubmissionJobQueueRecord;

      queue.addJobToQueue(jobQueueRecordStub);
      queue.addJobToQueue(jobQueueRecordStub);
      queue.addJobToQueue(jobQueueRecordStub);
      queue.addJobToQueue(jobQueueRecordStub);

      expect(queue.getJobQueueLength()).to.equal(4);
    });
  });

  describe('setJobQueueConcurrency', () => {
    it('sets the queue concurrency', () => {
      const queue = new Queue();

      expect(queue._queue.concurrency).to.equal(QUEUE_DEFAULT_CONCURRENCY);

      queue.setJobQueueConcurrency(2);

      expect(queue._queue.concurrency).to.equal(2);
    });
  });

  describe('setJobTimeout', () => {
    it('sets the queue timeout', () => {
      const queue = new Queue();

      expect(queue._timeout).to.equal(QUEUE_DEFAULT_TIMEOUT);

      queue.setJobTimeout(2000);

      expect(queue._timeout).to.equal(2000);
    });
  });
});

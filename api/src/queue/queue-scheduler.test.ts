import { expect } from 'chai';
import { describe } from 'mocha';
import { QueueScheduler } from './queue-scheduler';

describe('QueueScheduler', () => {
  it('constructs a new QueueScheduler', () => {
    const queue = new QueueScheduler();

    expect(queue).not.to.be.null;
    expect(queue).to.be.instanceof(QueueScheduler);
  });
});

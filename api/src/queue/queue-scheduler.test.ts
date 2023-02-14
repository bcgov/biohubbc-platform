import { expect } from 'chai';
import { describe } from 'mocha';
import sinonChai from 'sinon-chai';
import { QueueScheduler } from './queue-scheduler';

chai.use(sinonChai);

describe('QueueScheduler', () => {
  it('constructs a new QueueScheduler', () => {
    const queue = new QueueScheduler();

    expect(queue).not.to.be.null;
    expect(queue).to.be.instanceof(QueueScheduler);
  });
});

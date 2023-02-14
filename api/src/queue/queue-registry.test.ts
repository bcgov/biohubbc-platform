import { expect } from 'chai';
import { describe } from 'mocha';
import { QueueJobRegistry } from './queue-registry';

describe('QueueJobRegistry', () => {
  it('returns a known job function', () => {
    const job = QueueJobRegistry.findMatchingJob('dwc_dataset_submission');

    expect(job).not.to.be.null;
    expect(typeof job).to.equal('function');
  });

  it('returns null if no matching job found', () => {
    const job = QueueJobRegistry.findMatchingJob('not_a_real_job');

    expect(job).to.be.null;
  });
});

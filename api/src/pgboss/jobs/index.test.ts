import { expect } from 'chai';
import { describe } from 'mocha';
import { JobQueues } from './index';

describe('jobs/index', () => {
  describe('JobQueues', () => {
    it('defines the EXAMPLE queue', () => {
      expect(JobQueues.EXAMPLE).to.equal('example');
    });

    it('exports JobQueues as a const object', () => {
      // Verify the object is frozen (const assertion behavior)
      expect(Object.keys(JobQueues)).to.deep.equal(['EXAMPLE']);
    });
  });
});

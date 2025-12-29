import { expect } from 'chai';
import { describe } from 'mocha';
import { JobQueues } from './index';

describe('jobs/index', () => {
  describe('JobQueues', () => {
    it('defines the TEST queue', () => {
      expect(JobQueues.TEST).to.equal('test');
    });

    it('defines the PROCESS_SUBMISSION_FEATURES queue', () => {
      expect(JobQueues.PROCESS_SUBMISSION_FEATURES).to.equal('process-submission-features');
    });

    it('exports JobQueues as a const object', () => {
      // Verify the object contains expected keys
      expect(Object.keys(JobQueues)).to.deep.equal(['TEST', 'PROCESS_SUBMISSION_FEATURES']);
    });
  });
});

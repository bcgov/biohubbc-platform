import { expect } from 'chai';
import { describe } from 'mocha';
import { JobQueues } from './index';

describe('jobs/index', () => {
  describe('JobQueues', () => {
    it('defines the PROCESS_SUBMISSION_FEATURES queue', () => {
      expect(JobQueues.PROCESS_SUBMISSION_FEATURES).to.equal('process-submission-features');
    });

    it('defines the PROCESS_SUBMISSION_FEATURES_FAILED dead letter queue', () => {
      expect(JobQueues.PROCESS_SUBMISSION_FEATURES_FAILED).to.equal('process-submission-features-failed');
    });

    it('defines the MALWARE_SCAN queue', () => {
      expect(JobQueues.MALWARE_SCAN).to.equal('malware-scan');
    });

    it('defines the MALWARE_SCAN_FAILED dead letter queue', () => {
      expect(JobQueues.MALWARE_SCAN_FAILED).to.equal('malware-scan-failed');
    });

    it('exports JobQueues as a const object with expected keys', () => {
      expect(Object.keys(JobQueues)).to.deep.equal([
        'PROCESS_SUBMISSION_FEATURES',
        'PROCESS_SUBMISSION_FEATURES_FAILED',
        'MALWARE_SCAN',
        'MALWARE_SCAN_FAILED'
      ]);
    });
  });
});

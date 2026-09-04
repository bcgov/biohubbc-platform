import { expect } from 'chai';
import { getSupersededProcessingStatuses } from './submission-upload-status';

describe('getSupersededProcessingStatuses', () => {
  it('supersedes every stage and both failure outcomes when restarting from uploaded', () => {
    expect(getSupersededProcessingStatuses('uploaded')).to.eql([
      'uploaded',
      'ingesting',
      'ingested',
      'reconciling',
      'reconciled',
      'promoting',
      'promoted',
      'indexing',
      'indexed',
      'invalid',
      'failed'
    ]);
  });

  it('keeps earlier completed stages active when restarting indexing', () => {
    expect(getSupersededProcessingStatuses('indexing')).to.eql(['indexing', 'indexed', 'invalid', 'failed']);
  });

  it('supersedes only the final stage and the failure outcomes when completing indexing', () => {
    expect(getSupersededProcessingStatuses('indexed')).to.eql(['indexed', 'invalid', 'failed']);
  });

  it('supersedes only a prior row of the same status for a failure outcome', () => {
    expect(getSupersededProcessingStatuses('invalid')).to.eql(['invalid']);
    expect(getSupersededProcessingStatuses('failed')).to.eql(['failed']);
  });
});

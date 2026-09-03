import { mdiCheck, mdiClose, mdiHelpCircleOutline, mdiProgressClock } from '@mdi/js';
import appTheme from 'themes/appTheme';
import { getSubmissionUploadJobStatusPresentation, isSubmissionUploadJobStatus } from './submission-upload-status';

describe('isSubmissionUploadJobStatus', () => {
  it('accepts every processing status and rejects other strings', () => {
    expect(isSubmissionUploadJobStatus('uploaded')).toBe(true);
    expect(isSubmissionUploadJobStatus('promoted')).toBe(true);
    expect(isSubmissionUploadJobStatus('failed')).toBe(true);
    expect(isSubmissionUploadJobStatus('submitted')).toBe(false);
    expect(isSubmissionUploadJobStatus('toString')).toBe(false);
  });
});

describe('getSubmissionUploadJobStatusPresentation', () => {
  it('resolves the shared label and icon for an in-progress stage', () => {
    expect(getSubmissionUploadJobStatusPresentation('reconciling')).toEqual({
      label: 'Reconciling',
      iconPath: mdiProgressClock,
      iconColor: appTheme.palette.text.secondary,
      isKnown: true,
      isTerminal: false
    });
  });

  it('marks indexed as terminal with the success colour', () => {
    expect(getSubmissionUploadJobStatusPresentation('indexed')).toEqual({
      label: 'Indexed',
      iconPath: mdiCheck,
      iconColor: appTheme.palette.success.main,
      isKnown: true,
      isTerminal: true
    });
  });

  it('marks failed as terminal with the error colour', () => {
    expect(getSubmissionUploadJobStatusPresentation('failed')).toEqual({
      label: 'Failed',
      iconPath: mdiClose,
      iconColor: appTheme.palette.error.main,
      isKnown: true,
      isTerminal: true
    });
  });

  it('falls back to a neutral label and icon for an unknown status', () => {
    expect(getSubmissionUploadJobStatusPresentation('archiving')).toEqual({
      label: 'Unknown status',
      iconPath: mdiHelpCircleOutline,
      iconColor: appTheme.palette.text.secondary,
      isKnown: false,
      isTerminal: false
    });
  });
});

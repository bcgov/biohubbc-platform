import {
  SUBMISSION_UPLOAD_JOB_STATUS_ICONS,
  SUBMISSION_UPLOAD_JOB_STATUS_LABELS,
  SUBMISSION_UPLOAD_TERMINAL_JOB_STATUS_ICON_COLORS,
  TERMINAL_SUBMISSION_UPLOAD_JOB_STATUSES,
  UNKNOWN_SUBMISSION_UPLOAD_JOB_STATUS_ICON,
  UNKNOWN_SUBMISSION_UPLOAD_JOB_STATUS_LABEL
} from 'constants/submission-upload-status';
import { SubmissionUploadJobStatus } from 'interfaces/useTicketsApi.interface';
import appTheme from 'themes/appTheme';

export interface SubmissionUploadJobStatusPresentation {
  /** Human-readable status label. */
  label: string;
  /** `@mdi/js` icon path. */
  iconPath: string;
  /** Icon colour. */
  iconColor: string;
  /** Whether the status is one the frontend knows about. */
  isKnown: boolean;
  /** Whether processing has finished in this status (successfully or not). */
  isTerminal: boolean;
}

/**
 * Narrow an arbitrary status string to the processing statuses the frontend has presentation for.
 *
 * @param {string} status Status value received from the API.
 * @return {boolean} Whether `status` is a known `SubmissionUploadJobStatus`.
 */
export const isSubmissionUploadJobStatus = (status: string): status is SubmissionUploadJobStatus =>
  Object.hasOwn(SUBMISSION_UPLOAD_JOB_STATUS_LABELS, status);

/**
 * Resolve the shared label and icon for a processing status, falling back to a neutral
 * presentation for a status the frontend does not know, so a new backend stage never breaks the
 * timeline.
 *
 * @param {string} status Status value received from the API.
 * @return {SubmissionUploadJobStatusPresentation} Label, icon and flags for rendering the status.
 */
export const getSubmissionUploadJobStatusPresentation = (status: string): SubmissionUploadJobStatusPresentation => {
  if (!isSubmissionUploadJobStatus(status)) {
    return {
      label: UNKNOWN_SUBMISSION_UPLOAD_JOB_STATUS_LABEL,
      iconPath: UNKNOWN_SUBMISSION_UPLOAD_JOB_STATUS_ICON,
      iconColor: appTheme.palette.text.secondary,
      isKnown: false,
      isTerminal: false
    };
  }

  return {
    label: SUBMISSION_UPLOAD_JOB_STATUS_LABELS[status],
    iconPath: SUBMISSION_UPLOAD_JOB_STATUS_ICONS[status],
    iconColor: SUBMISSION_UPLOAD_TERMINAL_JOB_STATUS_ICON_COLORS[status] ?? appTheme.palette.text.secondary,
    isKnown: true,
    isTerminal: TERMINAL_SUBMISSION_UPLOAD_JOB_STATUSES.includes(status)
  };
};

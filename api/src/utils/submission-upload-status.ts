import {
  SUBMISSION_UPLOAD_FAILURE_STATUSES,
  SUBMISSION_UPLOAD_PROCESSING_STAGES
} from '../constants/submission-upload';
import { SubmissionUploadJobStatus } from '../models/submission-upload';

/**
 * Return the processing statuses whose active history rows a transition to `nextStatus` supersedes.
 *
 * Entering a lifecycle stage invalidates that stage and every later one, along with any failure
 * outcome of the superseded attempt, while earlier completed stages stay active. Entering a failure
 * status supersedes only an earlier active row of the same status, so at most one row per status is
 * active at a time.
 *
 * @param {SubmissionUploadJobStatus} nextStatus Status the upload is transitioning to.
 * @returns {SubmissionUploadJobStatus[]} Statuses whose active rows should be end-dated before the new row is inserted.
 */
export const getSupersededProcessingStatuses = (nextStatus: SubmissionUploadJobStatus): SubmissionUploadJobStatus[] => {
  const stageIndex = SUBMISSION_UPLOAD_PROCESSING_STAGES.indexOf(nextStatus);

  if (stageIndex === -1) {
    return [nextStatus];
  }

  return [...SUBMISSION_UPLOAD_PROCESSING_STAGES.slice(stageIndex), ...SUBMISSION_UPLOAD_FAILURE_STATUSES];
};

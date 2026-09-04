import { SQL, SQLStatement } from 'sql-template-strings';
import { SubmissionUploadJobStatus } from '../../models/submission-upload';
import { SubmissionUploadStatusTypeEnum } from '../../models/submission-upload-review-status';

/**
 * Predicate selecting the review decision rows of `submission_upload_status`.
 *
 * The table holds review decisions and processing statuses in one `status` column, so every
 * reader of one class filters with the matching predicate rather than carrying its own value list.
 *
 * @param {string} statusColumn - Qualified column reference, for example `sus.status`.
 * @returns {SQLStatement} - Predicate to embed in a `WHERE` clause.
 */
export const reviewStatusPredicate = (statusColumn: string): SQLStatement =>
  SQL``
    .append(statusColumn)
    .append(SQL` = ANY(${SubmissionUploadStatusTypeEnum.options}::submission_upload_status_type[])`);

/**
 * Predicate selecting the processing status rows of `submission_upload_status`.
 *
 * @param {string} statusColumn - Qualified column reference, for example `sus.status`.
 * @returns {SQLStatement} - Predicate to embed in a `WHERE` clause.
 */
export const processingStatusPredicate = (statusColumn: string): SQLStatement =>
  SQL``.append(statusColumn).append(SQL` = ANY(${SubmissionUploadJobStatus.options}::submission_upload_status_type[])`);

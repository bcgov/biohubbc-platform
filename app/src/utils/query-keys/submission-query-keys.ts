import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix of everything cached for one submission.
 *
 * @param {number} submissionId The submission.
 * @returns The submission key prefix.
 */
const submission = (submissionId: number) => [QUERY_KEY_ROOT.SUBMISSION, submissionId] as const;

/**
 * Key of one submission's record, with its security state.
 *
 * @param {number} submissionId The submission.
 * @returns The submission record key.
 */
const record = (submissionId: number) => [...submission(submissionId), 'record'] as const;

/**
 * Key of one page of a submission's features as administrators review them.
 *
 * @param {number} submissionId The submission.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The admin features key.
 */
const adminFeatures = (submissionId: number, pagination: ApiPaginationRequestOptions) =>
  [...submission(submissionId), 'admin-features', { pagination }] as const;

/**
 * Query keys for submissions, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const submissionQueryKeys = { submission, record, adminFeatures };

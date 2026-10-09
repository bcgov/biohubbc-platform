import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { SubmissionUploadScope } from 'interfaces/useAdminApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix for one upload's browsing data.
 * @param {SubmissionUploadScope} scope Submission and upload identifiers.
 * @returns Upload-scoped cache prefix.
 */
const upload = (scope: SubmissionUploadScope) =>
  [QUERY_KEY_ROOT.SUBMISSION_UPLOAD, scope.submissionId, scope.submissionUploadId, 'browse'] as const;

export const adminSubmissionUploadQueryKeys = {
  blueprint: (scope: SubmissionUploadScope) => [...upload(scope), 'blueprint'] as const,
  errors: (scope: SubmissionUploadScope, pagination: ApiPaginationRequestOptions) =>
    [...upload(scope), 'errors', { pagination }] as const
};

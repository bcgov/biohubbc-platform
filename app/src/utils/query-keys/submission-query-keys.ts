import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { SubmissionFilters } from 'interfaces/useSubmissionsApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key of one page of the current user's submissions.
 *
 * @param {SubmissionFilters} filters The search sent.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The user's submissions key.
 */
const userList = (filters: SubmissionFilters, pagination: ApiPaginationRequestOptions) =>
  [QUERY_KEY_ROOT.SUBMISSION, 'user-list', { filters, pagination }] as const;

/**
 * Key prefix of the submission lists on the administrators' dashboard.
 *
 * @returns The admin dashboard lists key prefix.
 */
const adminLists = () => [QUERY_KEY_ROOT.SUBMISSION, 'admin-list'] as const;

/**
 * Key of the submissions administrators see on their dashboard in one review state.
 *
 * @param {'unreviewed' | 'reviewed' | 'published'} reviewState The dashboard list.
 * @returns The admin dashboard list key.
 */
const adminList = (reviewState: 'unreviewed' | 'reviewed' | 'published') => [...adminLists(), reviewState] as const;

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
 * Key of the blueprint a submission's future uploads use by default.
 *
 * @param {number} submissionId The submission.
 * @returns The submission default blueprint key.
 */
const defaultBlueprint = (submissionId: number) => [...submission(submissionId), 'default-blueprint'] as const;

/**
 * Key of one page of uploads in the administrative submission view.
 *
 * @param {number} submissionId Submission being viewed.
 * @param {ApiPaginationRequestOptions} pagination Requested page and sorting.
 * @returns The submission uploads query key.
 */
const adminUploads = (submissionId: number, pagination: ApiPaginationRequestOptions) =>
  [...submission(submissionId), 'admin-uploads', { pagination }] as const;

/**
 * Key of one page of a submission's features as its submitter or the public sees them.
 *
 * @param {number} submissionId The submission.
 * @param {ApiPaginationRequestOptions} pagination The page and sort.
 * @returns The submission features key.
 */
const features = (submissionId: number, pagination: ApiPaginationRequestOptions) =>
  [...submission(submissionId), 'features', { pagination }] as const;

/**
 * Key prefix of everything cached for one submission feature.
 *
 * @param {number} submissionId The submission.
 * @param {number} submissionFeatureId The feature.
 * @returns The feature key prefix.
 */
const feature = (submissionId: number, submissionFeatureId: number) =>
  [...submission(submissionId), 'feature', submissionFeatureId] as const;

/**
 * Key of one submission feature's detail.
 *
 * @param {number} submissionId The submission.
 * @param {number} submissionFeatureId The feature.
 * @returns The feature detail key.
 */
const featureDetail = (submissionId: number, submissionFeatureId: number) =>
  [...feature(submissionId, submissionFeatureId), 'detail'] as const;

/**
 * Key of one page of a submission feature's properties.
 *
 * @param {number} submissionId The submission.
 * @param {number} submissionFeatureId The feature.
 * @param {ApiPaginationRequestOptions & { search?: string }} params The search, page and sort sent.
 * @returns The feature properties key.
 */
const featureProperties = (
  submissionId: number,
  submissionFeatureId: number,
  params: ApiPaginationRequestOptions & { search?: string }
) => [...feature(submissionId, submissionFeatureId), 'properties', params] as const;

/**
 * Query keys for submissions, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const submissionQueryKeys = {
  userList,
  adminLists,
  adminList,
  submission,
  record,
  defaultBlueprint,
  adminUploads,
  features,
  feature,
  featureDetail,
  featureProperties
};

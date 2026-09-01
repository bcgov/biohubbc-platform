import { AxiosInstance } from 'axios';
import {
  ICreateSubmission,
  IGetSubmissionsForUserResponse,
  ISubmissionFeatureForReviewResponse,
  ISubmissionUploadPart,
  PresignedUploadUrlResponse,
  SubmissionFilters,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';
import qs from 'qs';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSubmissionsApi = (axios: AxiosInstance) => {
  /**
   * Fetch the paginated submission features visible to the requesting user.
   *
   * @param {number} submissionId ID of the submission whose features should be returned.
   * @param {ApiPaginationRequestOptions} [pagination] Optional pagination and sorting parameters.
   * @returns {Promise<ISubmissionFeatureForReviewResponse>} Paginated visible submission features.
   */
  const getSubmissionFeatures = async (
    submissionId: number,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const { data } = await axios.get(`/api/submission/${submissionId}/feature`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params)
    });

    return data;
  };

  /**
   * Fetch submission record with security data by submission id.
   *
   * @param {number} submissionId
   * @return {*}
   */
  const getSubmissionRecordWithSecurity = async (submissionId: number): Promise<SubmissionRecordWithSecurity> => {
    const { data } = await axios.get(`api/submission/${submissionId}`);

    return data;
  };

  /**
   * Fetch all submissions that have not completed security review.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeature[]>}
   */
  const getUnreviewedSubmissionsForAdmins = async (): Promise<SubmissionRecordWithSecurityAndRootFeature[]> => {
    const { data } = await axios.get(`api/administrative/submission/unreviewed`);

    return data;
  };

  /**
   * Fetch all submissions that have completed security review.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeature[]>}
   */
  const getReviewedSubmissionsForAdmins = async (): Promise<SubmissionRecordWithSecurityAndRootFeature[]> => {
    const { data } = await axios.get(`api/administrative/submission/reviewed`);

    return data;
  };

  /**
   * Fetch all submissions that have completed security review and published.
   *
   * @return {*}  {Promise<SubmissionRecordWithSecurityAndRootFeature[]>}
   */
  const getPublishedSubmissionsForAdmins = async (): Promise<SubmissionRecordWithSecurityAndRootFeature[]> => {
    const { data } = await axios.get(`api/administrative/submission/published`);

    return data;
  };

  /**
   * Update (patch) a submission record.
   *
   * @param {number} submissionId
   * @param {{ security_reviewed?: boolean; published?: boolean }} patch
   * @return {*}
   */
  const updateSubmissionRecord = async (
    submissionId: number,
    patch: { security_reviewed?: boolean; published?: boolean }
  ) => {
    const { data } = await axios.patch(`api/administrative/submission/${submissionId}`, patch);

    return data;
  };

  /**
   * Fetch all published submission records for public users.
   *
   * @return {*}  {Promise<SubmissionRecordPublishedForPublic[]>}
   */
  const getPublishedSubmissions = async (): Promise<SubmissionRecordPublishedForPublic[]> => {
    const { data } = await axios.get(`api/submission/published`);

    return data;
  };

  /**
   * Fetch all submissions accessible to the currently authenticated user via their submission team membership.
   *
   * @param {SubmissionFilters} [filters]
   * @param {ApiPaginationRequestOptions} [pagination]
   * @returns {Promise<IGetSubmissionsForUserResponse>}
   */
  const getSubmissionsForUser = async (
    filters?: SubmissionFilters,
    pagination?: ApiPaginationRequestOptions
  ): Promise<IGetSubmissionsForUserResponse> => {
    const params = {
      ...filters,
      ...pagination
    };

    const { data } = await axios.get(`api/submission`, {
      params,
      paramsSerializer: (queryParams) => qs.stringify(queryParams)
    });

    return data;
  };

  /**
   * Initiate a new submission upload
   *
   * @param {ICreateSubmission} submission
   * @returns {Promise<PresignedUploadUrlResponse>}
   */
  const getSubmissionUploadUrls = async (submission: ICreateSubmission): Promise<PresignedUploadUrlResponse> => {
    const { data } = await axios.post(`api/submission/upload/archive`, submission);

    return data;
  };

  /**
   * Update the submission upload as completed
   *
   * @param {string} uploadId
   * @param {string} uploadArchiveId
   * @param {string} s3UploadId
   * @param {string} key
   * @param {ISubmissionUploadPart[]} parts
   * @returns {Promise<void>}
   */
  const completeSubmissionUpload = async (
    uploadId: string,
    s3UploadId: string,
    key: string,
    parts: ISubmissionUploadPart[]
  ): Promise<void> => {
    await axios.put(`api/upload/${uploadId}`, { s3UploadId, key, parts });
  };

  return {
    getSubmissionFeatures,
    getSubmissionRecordWithSecurity,
    getUnreviewedSubmissionsForAdmins,
    getReviewedSubmissionsForAdmins,
    getPublishedSubmissionsForAdmins,
    updateSubmissionRecord,
    getPublishedSubmissions,
    getSubmissionsForUser,
    getSubmissionUploadUrls,
    completeSubmissionUpload
  };
};

export default useSubmissionsApi;

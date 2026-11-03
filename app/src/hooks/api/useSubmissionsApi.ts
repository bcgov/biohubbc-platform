import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  AdminSubmissionListResponse,
  AdminSubmissionUploadListResponse,
  ICreateSubmission,
  AdminSubmissionUploadsResponse,
  IGetSubmissionsForUserResponse,
  ISubmissionFeatureForReviewResponse,
  ISubmissionUploadPart,
  PresignedUploadUrlResponse,
  SubmissionFilters,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity
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
   * Fetch one page of active uploads for the administrative submission view.
   *
   * @param {number} submissionId Submission whose uploads are listed.
   * @param {ApiPaginationRequestOptions} pagination Page and sort options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<AdminSubmissionUploadsResponse>} Uploads with server pagination totals.
   */
  const listAdminSubmissionUploads = async (
    submissionId: number,
    pagination: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<AdminSubmissionUploadsResponse> => {
    const { data } = await axios.get<AdminSubmissionUploadsResponse>(
      `api/administrative/submission/${submissionId}/upload`,
      { params: pagination, ...options }
    );
    return data;
  };

  /**
   * Fetch one page of every active submission for the administrative submissions page.
   *
   * @param {SubmissionFilters} filters Search matched against the submission name.
   * @param {ApiPaginationRequestOptions} pagination Page and sort options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<AdminSubmissionListResponse>} Submissions with server pagination totals.
   */
  const getAdminSubmissionList = async (
    filters: SubmissionFilters,
    pagination: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<AdminSubmissionListResponse> => {
    const { data } = await axios.get<AdminSubmissionListResponse>('api/administrative/submission', {
      params: { ...filters, ...pagination },
      ...options
    });
    return data;
  };

  /**
   * Fetch one page of the active uploads of every submission for the administrative submissions page.
   *
   * @param {SubmissionFilters} filters Search matched against the name of each upload's submission.
   * @param {ApiPaginationRequestOptions} pagination Page and sort options.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<AdminSubmissionUploadListResponse>} Uploads with server pagination totals.
   */
  const getAdminSubmissionUploadList = async (
    filters: SubmissionFilters,
    pagination: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<AdminSubmissionUploadListResponse> => {
    const { data } = await axios.get<AdminSubmissionUploadListResponse>('api/administrative/submission/upload', {
      params: { ...filters, ...pagination },
      ...options
    });
    return data;
  };

  /**
   * Fetch the paginated submission features visible to the requesting user.
   *
   * @param {number} submissionId ID of the submission whose features should be returned.
   * @param {ApiPaginationRequestOptions} [pagination] Optional pagination and sorting parameters.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<ISubmissionFeatureForReviewResponse>} Paginated visible submission features.
   */
  const getSubmissionFeatures = async (
    submissionId: number,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const { data } = await axios.get(`/api/submission/${submissionId}/feature`, {
      params: pagination,
      paramsSerializer: (params) => qs.stringify(params),
      ...options
    });

    return data;
  };

  /**
   * Fetch submission record with security data by submission id.
   *
   * @param {number} submissionId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*}
   */
  const getSubmissionRecordWithSecurity = async (
    submissionId: number,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<SubmissionRecordWithSecurity> => {
    const { data } = await axios.get(`api/submission/${submissionId}`, options);

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
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @returns {Promise<IGetSubmissionsForUserResponse>}
   */
  const getSubmissionsForUser = async (
    filters?: SubmissionFilters,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IGetSubmissionsForUserResponse> => {
    const params = {
      ...filters,
      ...pagination
    };

    const { data } = await axios.get(`api/submission`, {
      params,
      paramsSerializer: (queryParams) => qs.stringify(queryParams),
      ...options
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
    listAdminSubmissionUploads,
    getAdminSubmissionList,
    getAdminSubmissionUploadList,
    getSubmissionFeatures,
    getSubmissionRecordWithSecurity,
    getPublishedSubmissions,
    getSubmissionsForUser,
    getSubmissionUploadUrls,
    completeSubmissionUpload
  };
};

export default useSubmissionsApi;

import { AxiosInstance } from 'axios';
import {
  ICreateSubmission,
  IGetDownloadSubmissionResponse,
  ISubmissionFeatureForReviewResponse,
  ISubmissionUploadPart,
  PresignedUploadUrlResponse,
  SubmissionFeatureSignedUrlPayload,
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
   * repackages and retrieves json data from self and each child under submission
   *
   * @async
   * @returns {Promise<IGetDownloadSubmissionResponse[]>} json data repackaged from each level of children
   */
  const getSubmissionDownloadPackage = async (submissionId: number): Promise<IGetDownloadSubmissionResponse[]> => {
    const { data } = await axios.get(`/api/submission/${submissionId}/download`);

    return data;
  };

  /**
   * repackages and retrieves json data from self and each child under submission for published data
   *
   * @async
   * @returns {Promise<IGetDownloadSubmissionResponse[]>} json data repackaged from each level of children
   */
  const getSubmissionPublishedDownloadPackage = async (
    submissionId: number
  ): Promise<IGetDownloadSubmissionResponse[]> => {
    const { data } = await axios.get(`/api/submission/${submissionId}/published/download`);

    return data;
  };

  /**
   * For the given submission, fetches all features for a submission (flat),
   * with server-side pagination + sorting support.
   *
   * @param {number} submissionId
   * @param {ApiPaginationRequestOptions} pagination
   * @return {Promise<ISubmissionFeatureForReviewResponse>}
   */
  const getSubmissionFeatures = async (
    submissionId: number,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ISubmissionFeatureForReviewResponse> => {
    const params = {
      ...pagination
    };

    const { data } = await axios.get(`/api/submission/${submissionId}/features`, {
      params,
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
   * Fetch signed URL for a submission_feature (artifact) key value pair
   *
   * @async
   * @param {SubmissionFeatureSignedUrlPayload} params
   * @returns {Promise<string>} signed URL
   */
  const getSubmissionFeatureSignedUrl = async (params: SubmissionFeatureSignedUrlPayload): Promise<string> => {
    const { submissionFeatureKey, submissionFeatureValue, submissionId, submissionFeatureId } = params;

    const { data } = await axios.get(
      `api/submission/${submissionId}/features/${submissionFeatureId}/signed-url?key=${submissionFeatureKey}&value=${submissionFeatureValue}`
    );

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
    getSubmissionDownloadPackage,
    getSubmissionPublishedDownloadPackage,
    getSubmissionFeatures,
    getSubmissionRecordWithSecurity,
    getUnreviewedSubmissionsForAdmins,
    getReviewedSubmissionsForAdmins,
    getPublishedSubmissionsForAdmins,
    updateSubmissionRecord,
    getPublishedSubmissions,
    getSubmissionFeatureSignedUrl,
    getSubmissionUploadUrls,
    completeSubmissionUpload
  };
};

export default useSubmissionsApi;

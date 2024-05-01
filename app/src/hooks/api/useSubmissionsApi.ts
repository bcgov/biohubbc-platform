import { AxiosInstance } from 'axios';
import {
  IGetDownloadSubmissionResponse,
  IGetSubmissionGroupedFeatureResponse,
  SubmissionFeatureSignedUrlPayload,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRecordWithSecurityAndRootFeature
} from 'interfaces/useSubmissionsApi.interface';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSubmissionsApi = (axios: AxiosInstance) => {
  /**
   * Fetch the signed URL of a submission by submission ID.
   *
   * @return {*}  {Promise<string>}
   */
  const getSignedUrl = async (submissionId: number): Promise<string> => {
    const { data } = await axios.get<string>(`/api/dwc/submission/${submissionId}/getSignedUrl`);

    return data;
  };

  /** NET-NEW FRONTEND REQUESTS FOR UPDATED SCHEMA **/

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
   * For the given submission, fetches all feature groups (e.g., "dataset", "sample_site"), with their
   * respective features.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<IGetSubmissionFeatureResponse>}
   */
  const getSubmissionFeatureGroups = async (submissionId: number): Promise<IGetSubmissionGroupedFeatureResponse[]> => {
    const { data } = await axios.get(`api/submission/${submissionId}/features`);

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

  return {
    getSignedUrl,
    getSubmissionDownloadPackage,
    getSubmissionPublishedDownloadPackage,
    getSubmissionFeatureGroups,
    getSubmissionRecordWithSecurity,
    getUnreviewedSubmissionsForAdmins,
    getReviewedSubmissionsForAdmins,
    getPublishedSubmissionsForAdmins,
    updateSubmissionRecord,
    getPublishedSubmissions,
    getSubmissionFeatureSignedUrl
  };
};

export default useSubmissionsApi;

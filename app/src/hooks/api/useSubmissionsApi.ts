import { AxiosInstance } from 'axios';
import {
  IGetSubmissionFeatureResponse,
  IListSubmissionsResponse,
  SubmissionRecordPublished,
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
   * Fetch all submissions.
   *
   * @return {*}  {Promise<IListSubmissionsResponse>}
   */
  const listSubmissions = async (): Promise<IListSubmissionsResponse> => {
    const { data } = await axios.get('/api/dwc/submission/list');

    return data;
  };

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
   * Note: unknown how this will work with artifacts. SignedURL?
   *
   * @async
   * @returns {Promise<any>} json data repackaged from each level of children
   */
  const getSubmissionDownloadPackage = async (): Promise<any> => {
    return { mockJson: 'mockValue' };
  };

  /**
   * Fetch submission features
   *
   * @param {number} submissionId
   * @return {*}  {Promise<IGetSubmissionFeatureResponse>}
   */
  const getSubmissionFeatures = async (submissionId: number): Promise<IGetSubmissionFeatureResponse[]> => {
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

  const getSubmissionFeatureRules = async () => {};

  const applySubmissionFeatureRules = async (features: number[], rules: number[], override = false) => {
    const { data } = await axios.post(`api/administrative/security/apply`, {
      override,
      features,
      rules
    });
    return data;
  };

  /**
   * Fetch all published submission records.
   *
   * @return {*}  {Promise<SubmissionRecordPublished[]>}
   */
  const getPublishedSubmissions = async (): Promise<SubmissionRecordPublished[]> => {
    const { data } = await axios.get(`api/submission/published`);

    return data;
  };

  return {
    listSubmissions,
    getSignedUrl,
    getSubmissionDownloadPackage,
    getSubmissionFeatures,
    getSubmissionRecordWithSecurity,
    applySubmissionFeatureRules,
    getSubmissionFeatureRules,
    getUnreviewedSubmissionsForAdmins,
    getReviewedSubmissionsForAdmins,
    updateSubmissionRecord,
    getPublishedSubmissions
  };
};

export default useSubmissionsApi;

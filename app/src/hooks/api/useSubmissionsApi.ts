import { AxiosInstance } from 'axios';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import {
  IGetSubmissionFeatureResponse,
  IListSubmissionsResponse,
  ISubmission,
  SubmissionRecordWithRootFeature,
  SubmissionRecordWithSecurity
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
   * Fetch list of all reviewed submissions
   * NOTE: mock implementation
   * TODO: return real data once api endpoint created
   *
   * @async
   * @returns {*} {Promise<ISubmission[]>}
   */
  const listReviewedSubmissions = async (): Promise<ISubmission[]> => {
    const keywords = ['moose', 'caribou', 'deer', 'bear', 'bat'];
    const securityLevel = {
      0: SECURITY_APPLIED_STATUS.SECURED,
      1: SECURITY_APPLIED_STATUS.UNSECURED,
      2: SECURITY_APPLIED_STATUS.SECURED,
      3: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,
      4: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED
    };
    return keywords.map((keyword, idx) => ({
      submission_id: idx + 1,
      submission_feature_id: idx,
      name: `Dataset - ${keyword}`,
      description: `${keywords[idx] + 1 ?? 'test'} Lorem ipsum dolor sit amet, consectetur adipiscing elit. ${keyword}`,
      submission_date: new Date(Date.now() - 86400000 * (300 * idx)),
      security: securityLevel[idx]
    }));
  };

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
   * @return {*}  {Promise<SubmissionRecordWithRootFeature[]>}
   */
  const getUnreviewedSubmissions = async (): Promise<SubmissionRecordWithRootFeature[]> => {
    const { data } = await axios.get(`api/administrative/submission/unreviewed`);

    return data;
  };

  /**
   * Fetch all submissions that have completed security review.
   *
   * @return {*}  {Promise<SubmissionRecordWithRootFeature[]>}
   */
  const getReviewedSubmissions = async (): Promise<SubmissionRecordWithRootFeature[]> => {
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

  return {
    listSubmissions,
    getSignedUrl,
    listReviewedSubmissions,
    getSubmissionDownloadPackage,
    getSubmissionFeatures,
    getSubmissionRecordWithSecurity,
    applySubmissionFeatureRules,
    getSubmissionFeatureRules,
    getUnreviewedSubmissions,
    getReviewedSubmissions,
    updateSubmissionRecord
  };
};

export default useSubmissionsApi;

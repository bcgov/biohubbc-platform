import { AxiosInstance } from 'axios';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { IListSubmissionsResponse, ISubmission } from 'interfaces/useSubmissionsApi.interface';

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
   * Fetch submission data by submissionUUID.
   *
   * @param {string} submissionUUID
   * @return {*}  {Promise<any>} //TODO: type
   */
  const getSubmission = async (submissionUUID: string): Promise<any> => {
    const { data } = await axios.get(`api/submission/${submissionUUID}`);
    console.log('data', data);
    return data;
  };

  const getSubmissionFeatureRules = async () => {};

  const applySubmissionFeatureRules = async (
    submissionUUID: string,
    features: number[],
    rules: number[],
    override = false
  ) => {
    console.log(submissionUUID);
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
    getSubmission,
    applySubmissionFeatureRules,
    getSubmissionFeatureRules
  };
};

export default useSubmissionsApi;

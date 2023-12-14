import { AxiosInstance } from 'axios';
import { SECURITY_APPLIED_STATUS, SubmissionRecord } from 'interfaces/useDatasetApi.interface';
import { IGetSubmissionResponse, IListSubmissionsResponse, ISubmission } from 'interfaces/useSubmissionsApi.interface';

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
   * Fetch submission data by submission id.
   *
   * @param {number} submissionId
   * @return {*}  {Promise<IGetSubmissionResponse>}
   */
  const getSubmission = async (submissionId: number): Promise<IGetSubmissionResponse> => {
    const { data } = await axios.get(`api/submission/${submissionId}`);

    return data;
  };

  /**
   * Fetch all submissions that have not completed security review.
   *
   * @return {*}  {(Promise<
   *     (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
   *   >)}
   */
  const getUnreviewedSubmissions = async (): Promise<
    (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
  > => {
    const { data } = await axios.get(`api/administrative/submission/unreviewed`);

    return data;
  };

  /**
   * Fetch all submissions that have completed security review.
   *
   * @return {*}  {(Promise<
   *     (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
   *   >)}
   */
  const getReviewedSubmissions = async (): Promise<
    (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
  > => {
    const { data } = await axios.get(`api/administrative/submission/reviewed`);

    return data;
  };

  /**
   * Update (patch) a submission record.
   *
   * @param {number} submissionId
   * @param {{ security_reviewed: boolean }} patch
   * @return {*}
   */
  const updateSubmissionRecord = async (submissionId: number, patch: { security_reviewed: boolean }) => {
    const { data } = await axios.patch(`api/administrative/submission/${submissionId}`, { patch });

    return data;
  };

  return {
    listSubmissions,
    getSignedUrl,
    listReviewedSubmissions,
    getSubmissionDownloadPackage,
    getSubmission,
    getUnreviewedSubmissions,
    getReviewedSubmissions,
    updateSubmissionRecord
  };
};

export default useSubmissionsApi;

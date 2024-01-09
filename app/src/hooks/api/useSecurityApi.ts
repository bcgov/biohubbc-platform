import { AxiosInstance } from 'axios';
import { IListPersecutionHarmResponse, IPatchFeatureSecurityRules, ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';

export interface ISecurityRule {
  security_rule_id: number;
  name: string;
  category: string;
  description: string;
  record_effective_date: string;
  record_end_date: string;
  create_date: string;
  create_user: number;
  update_date: string;
  update_user: number;
  revision_count: number;
}

export interface ISecurityRuleAndCategory {
  security_rule_id: number;
  name: string;
  description: string;
  record_effective_date: string;
  record_end_date: string;
  security_category_id: number;
  category_name: string;
  category_description: string;
  category_record_effective_date: string;
  category_record_end_date: string;
}

export interface ISubmissionFeatureSecurityRecord {
  submission_feature_security_id: number;
  submission_feature_id: number;
  security_rule_id: number;
}

/**
 * Returns a set of supported api methods for working with security.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSecurityApi = (axios: AxiosInstance) => {
  /**
   * Fetches a list of persecution and harm rules.
   *
   * @return {*}  {Promise<IListPersecutionHarmResponse>}
   */
  const listPersecutionHarmRules = async (): Promise<IListPersecutionHarmResponse> => {
    const { data } = await axios.get('/api/security/persecution-harm/list');

    return data;
  };

  /**
   * Apply security reasons for artifacts
   *
   * @param {{ artifact_id: number }[]} selectedArtifacts
   * @param {{ id: number }[]} securityReasons
   * @return {*}  {Promise<{ artifact_persecution_id: number }[]>}
   */
  const applySecurityReasonsToArtifacts = async (
    selectedArtifacts: { artifact_id: number }[],
    securityReasons: { id: number }[]
  ): Promise<{ artifact_persecution_id: number }[]> => {
    const artifactIds = selectedArtifacts.map((artifact) => artifact.artifact_id);
    const securityReasonIds = securityReasons.map((securityReason) => securityReason.id);

    const { data } = await axios.post('/api/security/persecution-harm/apply', {
      artifactIds: artifactIds,
      securityReasonIds: securityReasonIds
    });

    return data;
  };

  /**
   * Send secure artifact access request
   *
   * @param {ISecureDataAccessRequestForm} requestData
   * @return {*}  {Promise<boolean>}
   */
  const sendSecureArtifactAccessRequest = async (requestData: ISecureDataAccessRequestForm): Promise<boolean> => {
    const { data } = await axios.post('api/artifact/security/requestAccess', requestData);

    return data;
  };

  /**
   * Gets a list of all active security rules. A security rule is active if it has not
   * been end-dated.
   */
  const getActiveSecurityRules = async (): Promise<ISecurityRule[]> => {
    const { data } = await axios.get('api/administrative/security/rules');
    return data;
  };

  /**
   * Gets a list of all active security rules with associated categories. A security rule is
   * active if it has not been end-dated.
   */
  const getActiveSecurityRulesAndCategories = async (): Promise<ISecurityRuleAndCategory[]> => {
    // TODO confirm if the JSDOC for this function is actually true...
    const { data } = await axios.get('api/administrative/security/categories');
    return data;
  };

  /**
   * Patches security rules that are applied or removed to the given set of submission features. If
   * a particular rule happens to belong to both `applyRuleIds` and `removeRuleIds`, it will always
   * be added. 
   *
   * @param {number[]} submissionFeatureIds
   * @param {number[]} ruleIds
   * @return {*}  {Promise<any[]>}
   */
  const applySecurityRulesToSubmissionFeatures = async (
    submissionId: number,
    featureSecurityRulesPath: IPatchFeatureSecurityRules
  ): Promise<ISubmissionFeatureSecurityRecord[]> => {
    const { data } = await axios.patch(`api/administrative/security/submission/${submissionId}`, featureSecurityRulesPath);

    return data;
  };

  /**
   * Removes all of the security rules for the given submission feature IDs, rendering them unsecure.
   *
   * @deprecated Not supported. Use `applySecurityRulesToSubmissionFeatures` instead.
   *
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<any[]>}
   */
  const removeSecurityRulesFromSubmissionFeatures = async (submissionFeatureIds: number[]): Promise<any[]> => { // TODO delete this function
    const { data } = await axios.post('api/administrative/security/remove', {
      features: submissionFeatureIds
    });

    return data;
  };

  /**
   * Retrieves the list of all security rule IDs associated with the list of given submission feature IDs
   *
   * @deprecated Not supported. You can retrieve the list of all security rule IDs associated with all of the
   * features belonging to a particular submission using `getAllSecurityRulesForSubmission`
   * 
   * @param {number[]} features
   * @return {*}  {Promise<ISubmissionFeatureSecurityRecord[]>}
   */
  const getSecurityRulesForSubmissionFeatures = async ( // TODO delete this function
    submissionFeatureIds: number[]
  ): Promise<ISubmissionFeatureSecurityRecord[]> => {
    const { data } = await axios.post('api/administrative/security/fetch', {
      submissionFeatureIds
    });

    return data;
  };

  /**
   * Retrieves the list of all security rule IDs associated with the features belonging to the given submission.
   *
   * @param {number[]} features
   * @return {*}  {Promise<ISubmissionFeatureSecurityRecord[]>}
   */
  const getAllSecurityRulesForSubmission = async (
    submissionId: number
  ): Promise<ISubmissionFeatureSecurityRecord[]> => {
    const { data } = await axios.get(`api/administrative/security/submission/${submissionId}`);

    return data;
  };

  return {
    sendSecureArtifactAccessRequest,
    listPersecutionHarmRules,
    applySecurityReasonsToArtifacts,
    getActiveSecurityRules,
    applySecurityRulesToSubmissionFeatures,
    removeSecurityRulesFromSubmissionFeatures,
    getSecurityRulesForSubmissionFeatures,
    getAllSecurityRulesForSubmission,
    getActiveSecurityRulesAndCategories
  };
};

export default useSecurityApi;

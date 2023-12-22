import { AxiosInstance } from 'axios';
import { IListPersecutionHarmResponse, ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';

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

  const getActiveSecurityRules = async (): Promise<ISecurityRule[]> => {
    const { data } = await axios.get('api/administrative/security');
    return data;
  };

  const getActiveSecurityRulesAndCategories = async (): Promise<ISecurityRuleAndCategory[]> => {
    const { data } = await axios.get('api/administrative/security/category/fetch');
    return data;
  };

  const addSecurityRule = async (newRule: {
    name: string;
    description: string;
    record_effective_date: string;
    record_end_date?: string;
  }): Promise<number> => {
    await axios.post('api/administrative/security', {});
    // new item id
    return 1;
  };

  /**
   * Applies all of the given security rule IDs to all of the given submission feature IDs. If the
   * `override` parameter is supplied as `true`, then all rules for these submission features will
   * be replaced with the incoming set. Otherwise, the union of the existing rules and supplied
   * rules will be applied to these features (deafult behaviour).
   *
   * @param {number[]} submissionFeatureIds
   * @param {number[]} ruleIds
   * @return {*}  {Promise<any[]>}
   */
  const applySecurityRulesToSubmissionFeatures = async (
    submissionFeatureIds: number[],
    ruleIds: number[],
    override = false
  ): Promise<any[]> => {
    const { data } = await axios.post('api/administrative/security/apply', {
      override,
      features: submissionFeatureIds,
      rules: ruleIds
    });

    return data;
  };

  /**
   * Removes all of the security rules for the given submission feature IDs, rendering them unsecure.
   *
   * @deprecated Use `applySecurityRulesToSubmissionFeatures(submissionFeatureIds, [], true)`
   * 
   * @param {number[]} submissionFeatureIds
   * @return {*}  {Promise<any[]>}
   */
  const removeSecurityRulesFromSubmissionFeatures = async (submissionFeatureIds: number[]): Promise<any[]> => {
    const { data } = await axios.post('api/administrative/security/remove', {
      features: submissionFeatureIds
    });

    return data;
  };

  /**
   * Retrieves the list of all security rule IDs associated with the list of given submission feature IDs
   *
   * @param {number[]} features
   * @return {*}  {Promise<ISubmissionFeatureSecurityRecord[]>}
   */
  const getSecurityRulesForSubmissionFeatures = async (
    features: number[]
  ): Promise<ISubmissionFeatureSecurityRecord[]> => {
    const { data } = await axios.post('api/administrative/security/fetch', {
      features
    });

    return data;
  };

  return {
    sendSecureArtifactAccessRequest,
    listPersecutionHarmRules,
    applySecurityReasonsToArtifacts,
    getActiveSecurityRules,
    addSecurityRule,
    applySecurityRulesToSubmissionFeatures,
    removeSecurityRulesFromSubmissionFeatures,
    getSecurityRulesForSubmissionFeatures,
    getActiveSecurityRulesAndCategories
  };
};

export default useSecurityApi;

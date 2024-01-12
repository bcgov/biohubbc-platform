import { AxiosInstance } from 'axios';
import {
  IListPersecutionHarmResponse,
  IPatchFeatureSecurityRules,
  ISecureDataAccessRequestForm
} from 'interfaces/useSecurityApi.interface';

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
   * Gets a list of all active security rules with associated categories. A security rule is
   * active if it has not been end-dated.
   */
  const getActiveSecurityRulesWithCategories = async (): Promise<ISecurityRuleAndCategory[]> => {
    const { data } = await axios.get('api/administrative/security/rules');

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
  const patchSecurityRulesOnSubmissionFeatures = async (
    submissionId: number,
    featureSecurityRulesPatch: IPatchFeatureSecurityRules
  ): Promise<void> => {
    const { data } = await axios.patch(`api/administrative/security/submission/${submissionId}`, {
      applyRuleIds: featureSecurityRulesPatch.stagedForApply.map((rule) => rule.security_rule_id),
      removeRuleIds: featureSecurityRulesPatch.stagedForRemove.map((rule) => rule.security_rule_id),
      submissionFeatureIds: featureSecurityRulesPatch.submissionFeatureIds
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
    patchSecurityRulesOnSubmissionFeatures,
    getAllSecurityRulesForSubmission,
    getActiveSecurityRulesWithCategories
  };
};

export default useSecurityApi;

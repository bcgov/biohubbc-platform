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

  const applySecurityRulesToSubmissions = async (features: number[], rules: number[]): Promise<any[]> => {
    const { data } = await axios.post('api/administrative/security/apply', {
      features,
      rules
    });
    return data;
  };

  const removeSecurityRulesToSubmissions = async (features: number[]): Promise<any[]> => {
    const { data } = await axios.post('api/administrative/security/remove', {
      features
    });
    return data;
  };

  const getSecurityRulesForSubmissions = async (features: number[]): Promise<ISubmissionFeatureSecurityRecord[]> => {
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
    applySecurityRulesToSubmissions,
    removeSecurityRulesToSubmissions,
    getSecurityRulesForSubmissions
  };
};

export default useSecurityApi;

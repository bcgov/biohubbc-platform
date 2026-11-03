import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  ICreateSecurityCategoryRequest,
  ICreateSecurityRuleRequest,
  IListPersecutionHarmResponse,
  ISecureDataAccessRequestForm,
  ISecurityCategoriesResponse,
  ISecurityCategory,
  ISecurityCategoryDetails,
  ISecurityRule,
  ISecurityRulesResponse,
  ISecurityRulesSearchParams,
  IUpdateSecurityCategoryRequest,
  IUpdateSecurityRuleRequest
} from 'interfaces/useSecurityApi.interface';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

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
   * Gets paginated security categories with associated rule counts.
   *
   * @param {ApiSearchParams} [searchParams]
   * @param {ApiPaginationRequestOptions} [pagination]
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<ISecurityCategoriesResponse>}
   */
  const getSecurityCategories = async (
    searchParams?: ApiSearchParams,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISecurityCategoriesResponse> => {
    const params = { ...searchParams, ...pagination };
    const { data } = await axios.get('/api/administrative/security/categories', { params, ...options });

    return data;
  };

  /**
   * Gets a security category by ID, with when it was created and who created it.
   *
   * @param {number} securityCategoryId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<ISecurityCategoryDetails>}
   */
  const getSecurityCategory = async (
    securityCategoryId: number,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISecurityCategoryDetails> => {
    const { data } = await axios.get(`/api/administrative/security/categories/${securityCategoryId}`, options);

    return data;
  };

  /**
   * Gets paginated security rules with associated feature counts, optionally limited to one security category.
   *
   * @param {ISecurityRulesSearchParams} [searchParams]
   * @param {ApiPaginationRequestOptions} [pagination]
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {Promise<ISecurityRulesResponse>}
   */
  const getSecurityRules = async (
    searchParams?: ISecurityRulesSearchParams,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<ISecurityRulesResponse> => {
    const params = { ...searchParams, ...pagination };
    const { data } = await axios.get('/api/administrative/security/reasons', { params, ...options });

    return data;
  };

  /**
   * Create a new security category.
   *
   * @param {ICreateSecurityCategoryRequest} body
   * @return {Promise<ISecurityCategory>}
   */
  const createSecurityCategory = async (body: ICreateSecurityCategoryRequest): Promise<ISecurityCategory> => {
    const { data } = await axios.post('/api/administrative/security/categories', body);
    return data;
  };

  /**
   * Update an existing security category.
   *
   * @param {number} securityCategoryId
   * @param {IUpdateSecurityCategoryRequest} body
   * @return {Promise<ISecurityCategory>}
   */
  const updateSecurityCategory = async (
    securityCategoryId: number,
    body: IUpdateSecurityCategoryRequest
  ): Promise<ISecurityCategory> => {
    const { data } = await axios.put(`/api/administrative/security/categories/${securityCategoryId}`, body);
    return data;
  };

  /**
   * Delete a security category.
   *
   * @param {number} securityCategoryId
   * @return {Promise<void>}
   */
  const deleteSecurityCategory = async (securityCategoryId: number): Promise<void> => {
    await axios.delete(`/api/administrative/security/categories/${securityCategoryId}`);
  };

  /**
   * Create a new security rule.
   *
   * @param {ICreateSecurityRuleRequest} body
   * @return {Promise<ISecurityRule>}
   */
  const createSecurityRule = async (body: ICreateSecurityRuleRequest): Promise<ISecurityRule> => {
    const { data } = await axios.post('/api/administrative/security/reasons', body);
    return data;
  };

  /**
   * Update an existing security rule.
   *
   * @param {number} securityRuleId
   * @param {IUpdateSecurityRuleRequest} body
   * @return {Promise<ISecurityRule>}
   */
  const updateSecurityRule = async (
    securityRuleId: number,
    body: IUpdateSecurityRuleRequest
  ): Promise<ISecurityRule> => {
    const { data } = await axios.put(`/api/administrative/security/reasons/${securityRuleId}`, body);
    return data;
  };

  /**
   * Delete a security rule.
   *
   * @param {number} securityRuleId
   * @return {Promise<void>}
   */
  const deleteSecurityRule = async (securityRuleId: number): Promise<void> => {
    await axios.delete(`/api/administrative/security/reasons/${securityRuleId}`);
  };

  return {
    sendSecureArtifactAccessRequest,
    listPersecutionHarmRules,
    applySecurityReasonsToArtifacts,
    getSecurityCategories,
    getSecurityCategory,
    getSecurityRules,
    createSecurityCategory,
    updateSecurityCategory,
    deleteSecurityCategory,
    createSecurityRule,
    updateSecurityRule,
    deleteSecurityRule
  };
};

export default useSecurityApi;

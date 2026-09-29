import { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  IPolicy,
  IPolicySummary,
  IPoliciesResponse,
  ICreatePolicyExpressionRequest,
  ICreatePolicyStatementRequest,
  ICreatePolicyRequest,
  IPolicyExpression,
  IPolicyExpressionsResponse,
  IPolicyStatement,
  IPolicyTeamsResponse,
  IUpdatePolicyRequest,
  IUpdatePolicyStatusRequest
} from 'interfaces/usePoliciesApi.interface';
import { ApiPaginationRequestOptions, ApiSearchParams } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with policies.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const usePoliciesApi = (axios: AxiosInstance) => {
  /**
   * Get all policies with pagination.
   *
   * @param {ApiSearchParams} [searchParams] - Optional search parameters.
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IPoliciesResponse>}
   */
  const getPolicies = async (
    searchParams?: ApiSearchParams,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IPoliciesResponse> => {
    const params = { ...searchParams, ...pagination };
    const { data } = await axios.get('/api/administrative/policies', { params, ...options });

    return data;
  };

  /**
   * Get a single policy by ID.
   *
   * @param {string} policyId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IPolicy>}
   */
  const getPolicy = async (policyId: string, options?: Pick<AxiosRequestConfig, 'signal'>): Promise<IPolicy> => {
    const { data } = await axios.get(`/api/administrative/policies/${policyId}`, options);

    return data;
  };

  /**
   * Get policy expressions for a policy with pagination.
   *
   * @param {string} policyId
   * @param {ApiPaginationRequestOptions} [pagination]
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IPolicyExpressionsResponse>}
   */
  const getPolicyExpressions = async (
    policyId: string,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IPolicyExpressionsResponse> => {
    const { data } = await axios.get(`/api/administrative/policies/${policyId}/expressions`, {
      params: pagination,
      ...options
    });

    return data;
  };

  /**
   * Get teams associated with a policy with pagination.
   *
   * @param {string} policyId
   * @param {ApiPaginationRequestOptions} [pagination]
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*} {Promise<IPolicyTeamsResponse>}
   */
  const getPolicyTeams = async (
    policyId: string,
    pagination?: ApiPaginationRequestOptions,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IPolicyTeamsResponse> => {
    const { data } = await axios.get(`/api/administrative/policies/${policyId}/teams`, {
      params: pagination,
      ...options
    });

    return data;
  };

  /**
   * Create a new policy.
   *
   * @param {ICreatePolicyRequest} policy
   * @return {*} {Promise<IPolicy>}
   */
  const createPolicy = async (policy: ICreatePolicyRequest): Promise<IPolicy> => {
    const { data } = await axios.post('/api/administrative/policies', policy);

    return data;
  };

  /**
   * Create a policy expression.
   *
   * @param {string} policyId
   * @param {ICreatePolicyExpressionRequest} policyExpression
   * @return {*} {Promise<IPolicyExpression>}
   */
  const createPolicyExpression = async (
    policyId: string,
    policyExpression: ICreatePolicyExpressionRequest
  ): Promise<IPolicyExpression> => {
    const { data } = await axios.post(`/api/administrative/policies/${policyId}/expressions`, policyExpression);

    return data;
  };

  /**
   * Update a policy expression.
   *
   * @param {string} policyId
   * @param {string} policyExpressionId
   * @param {ICreatePolicyExpressionRequest} policyExpression
   * @return {*} {Promise<IPolicyExpression>}
   */
  const updatePolicyExpression = async (
    policyId: string,
    policyExpressionId: string,
    policyExpression: ICreatePolicyExpressionRequest
  ): Promise<IPolicyExpression> => {
    const { data } = await axios.put(
      `/api/administrative/policies/${policyId}/expressions/${policyExpressionId}`,
      policyExpression
    );

    return data;
  };

  /**
   * Delete a policy expression.
   *
   * @param {string} policyId
   * @param {string} policyExpressionId
   * @return {*} {Promise<void>}
   */
  const deletePolicyExpression = async (policyId: string, policyExpressionId: string): Promise<void> => {
    await axios.delete(`/api/administrative/policies/${policyId}/expressions/${policyExpressionId}`);
  };

  /**
   * Update an existing policy.
   *
   * @param {string} policyId
   * @param {IUpdatePolicyRequest} policy
   * @return {*} {Promise<IPolicy>}
   */
  const updatePolicy = async (policyId: string, policy: IUpdatePolicyRequest): Promise<IPolicySummary> => {
    const { data } = await axios.put(`/api/administrative/policies/${policyId}`, policy);

    return data;
  };

  /**
   * Create a policy statement.
   *
   * @param {string} policyId
   * @param {ICreatePolicyStatementRequest} policyStatement
   * @return {*} {Promise<IPolicyStatement>}
   */
  const createPolicyStatement = async (
    policyId: string,
    policyStatement: ICreatePolicyStatementRequest
  ): Promise<IPolicyStatement> => {
    const { data } = await axios.post(`/api/administrative/policies/${policyId}/statements`, policyStatement);

    return data;
  };

  /**
   * Update a policy statement.
   *
   * @param {string} policyId
   * @param {string} policyStatementId
   * @param {ICreatePolicyStatementRequest} policyStatement
   * @return {*} {Promise<IPolicyStatement>}
   */
  const updatePolicyStatement = async (
    policyId: string,
    policyStatementId: string,
    policyStatement: ICreatePolicyStatementRequest
  ): Promise<IPolicyStatement> => {
    const { data } = await axios.put(
      `/api/administrative/policies/${policyId}/statements/${policyStatementId}`,
      policyStatement
    );

    return data;
  };

  /**
   * Delete a policy statement.
   *
   * @param {string} policyId
   * @param {string} policyStatementId
   * @return {*} {Promise<void>}
   */
  const deletePolicyStatement = async (policyId: string, policyStatementId: string): Promise<void> => {
    await axios.delete(`/api/administrative/policies/${policyId}/statements/${policyStatementId}`);
  };

  /**
   * Update policy lifecycle status.
   *
   * @param {string} policyId
   * @param {IUpdatePolicyStatusRequest} payload
   * @return {*} {Promise<IPolicy>}
   */
  const updatePolicyStatus = async (policyId: string, payload: IUpdatePolicyStatusRequest): Promise<IPolicySummary> => {
    const { data } = await axios.patch(`/api/administrative/policies/${policyId}/status`, payload);

    return data;
  };

  /**
   * Delete a policy.
   *
   * @param {string} policyId
   * @return {*} {Promise<void>}
   */
  const deletePolicy = async (policyId: string): Promise<void> => {
    await axios.delete(`/api/administrative/policies/${policyId}`);
  };

  return {
    getPolicies,
    getPolicy,
    getPolicyExpressions,
    getPolicyTeams,
    createPolicy,
    createPolicyExpression,
    updatePolicyExpression,
    deletePolicyExpression,
    createPolicyStatement,
    updatePolicyStatement,
    deletePolicyStatement,
    updatePolicy,
    updatePolicyStatus,
    deletePolicy
  };
};

export default usePoliciesApi;

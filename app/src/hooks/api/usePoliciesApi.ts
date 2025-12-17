import { AxiosInstance } from 'axios';
import {
  IPolicy,
  IPoliciesResponse,
  ICreatePolicyRequest,
  IUpdatePolicyRequest
} from 'interfaces/usePoliciesApi.interface';

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
   * @param {object} [params]
   * @return {*} {Promise<IPoliciesResponse>}
   */
  const getPolicies = async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<IPoliciesResponse> => {
    const { data } = await axios.get('/api/administrative/policies', { params });

    return data;
  };

  /**
   * Get a single policy by ID.
   *
   * @param {string} policyId
   * @return {*} {Promise<IPolicy>}
   */
  const getPolicy = async (policyId: string): Promise<IPolicy> => {
    const { data } = await axios.get(`/api/administrative/policies/${policyId}`);

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
   * Update an existing policy.
   *
   * @param {string} policyId
   * @param {IUpdatePolicyRequest} policy
   * @return {*} {Promise<IPolicy>}
   */
  const updatePolicy = async (policyId: string, policy: IUpdatePolicyRequest): Promise<IPolicy> => {
    const { data } = await axios.put(`/api/administrative/policies/${policyId}`, policy);

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
    createPolicy,
    updatePolicy,
    deletePolicy
  };
};

export default usePoliciesApi;

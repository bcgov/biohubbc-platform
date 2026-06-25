import { AxiosInstance } from 'axios';
import {
  ICreateTeamPoliciesRequest,
  ICreateTeamPoliciesResponse,
  ICreateTeamPolicyRequest,
  ITeamPoliciesResponse,
  ITeamPolicySearchParams,
  ITeamPolicy
} from 'interfaces/useTeamPoliciesApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns a set of supported api methods for working with team-policy associations.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTeamPoliciesApi = (axios: AxiosInstance) => {
  /**
   * Get all team-policy associations with team and policy names.
   *
   * @param {ApiSearchParams} [searchParams] - Optional search parameters.
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination parameters.
   * @return {*} {Promise<ITeamPoliciesResponse>}
   */
  const getTeamPolicies = async (
    searchParams?: ITeamPolicySearchParams,
    pagination?: ApiPaginationRequestOptions
  ): Promise<ITeamPoliciesResponse> => {
    const params = { ...searchParams, ...pagination };
    const { data } = await axios.get('/api/administrative/policies/team', { params });

    return data;
  };

  /**
   * Associate a team with a policy.
   *
   * @param {string} policyId
   * @param {ICreateTeamPolicyRequest} request
   * @return {*} {Promise<ITeamPolicy>}
   */
  const createTeamPolicy = async (policyId: string, request: ICreateTeamPolicyRequest): Promise<ITeamPolicy> => {
    const { data } = await axios.post(`/api/administrative/policies/${policyId}/team`, request);

    return data;
  };

  /**
   * Create team-policy associations in bulk for a single team.
   *
   * @param {string} teamId
   * @param {ICreateTeamPoliciesRequest} request
   * @return {*} {Promise<ICreateTeamPoliciesResponse>}
   */
  const createTeamPolicies = async (
    teamId: string,
    request: ICreateTeamPoliciesRequest
  ): Promise<ICreateTeamPoliciesResponse> => {
    const { data } = await axios.post(`/api/administrative/teams/${teamId}/policy`, request);

    return data;
  };

  /**
   * Delete a team-policy association.
   *
   * @param {string} teamPolicyId
   * @return {*} {Promise<void>}
   */
  const deleteTeamPolicy = async (teamPolicyId: string): Promise<void> => {
    await axios.delete(`/api/administrative/policies/team/${teamPolicyId}`);
  };

  return {
    getTeamPolicies,
    createTeamPolicy,
    createTeamPolicies,
    deleteTeamPolicy
  };
};

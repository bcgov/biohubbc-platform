import { AxiosInstance } from 'axios';
import { ICreateTeamPolicyRequest, ITeamPoliciesResponse, ITeamPolicy } from 'interfaces/useTeamPoliciesApi.interface';

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
   * @return {*} {Promise<ITeamPoliciesResponse>}
   */
  const getTeamPolicies = async (): Promise<ITeamPoliciesResponse> => {
    const { data } = await axios.get('/api/administrative/team-policies');

    return data;
  };

  /**
   * Create a team-policy association.
   *
   * @param {ICreateTeamPolicyRequest} request
   * @return {*} {Promise<ITeamPolicy>}
   */
  const createTeamPolicy = async (request: ICreateTeamPolicyRequest): Promise<ITeamPolicy> => {
    const { data } = await axios.post('/api/administrative/team-policies', request);

    return data;
  };

  /**
   * Delete a team-policy association.
   *
   * @param {string} teamPolicyId
   * @return {*} {Promise<void>}
   */
  const deleteTeamPolicy = async (teamPolicyId: string): Promise<void> => {
    await axios.delete(`/api/administrative/team-policies/${teamPolicyId}`);
  };

  return {
    getTeamPolicies,
    createTeamPolicy,
    deleteTeamPolicy
  };
};

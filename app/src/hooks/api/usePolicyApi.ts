import { AxiosInstance } from 'axios';
import { IPolicy } from 'interfaces/usePolicyApi.interface';
import { IListPersecutionHarmResponse } from 'interfaces/useSecurityApi.interface';

/**
 * Provides API methods for working with security policies.
 *
 * @param {AxiosInstance} axios - The Axios instance used for making HTTP requests.
 * @returns An object containing methods to interact with policies.
 */
export const usePolicyApi = (axios: AxiosInstance) => {
  /**
   * Fetches the list of persecution and harm policies.
   *
   * @async
   * @function
   * @returns {Promise<IListPersecutionHarmResponse>} A promise that resolves to the list of policies.
   */
  const getPolicies = async (): Promise<IListPersecutionHarmResponse> => {
    const { data } = await axios.get('/api/policy');
    return data;
  };

  /**
   * Creates a new policy
   *
   * @returns {Promise<void>}
   */
  const createPolicy = async (policy: IPolicy): Promise<void> => {
    return axios.post('/api/policy', { policy });
  };

  return { getPolicies, createPolicy };
};

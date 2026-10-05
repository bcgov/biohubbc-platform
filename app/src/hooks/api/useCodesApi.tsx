import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';

/**
 * Returns a set of supported api methods
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useCodesApi = (axios: AxiosInstance) => {
  /**
   * Fetch all code sets.
   *
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options] Request cancellation.
   * @return {*}  {Promise<IGetAllCodeSetsResponse>}
   */
  const getAllCodeSets = async (options?: Pick<AxiosRequestConfig, 'signal'>): Promise<IGetAllCodeSetsResponse> => {
    const { data } = await axios.get('/api/codes/', options);

    return data;
  };

  return {
    getAllCodeSets
  };
};

export default useCodesApi;

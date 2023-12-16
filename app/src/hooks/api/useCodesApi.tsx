import { AxiosInstance } from 'axios';
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
   * @return {*}  {Promise<IGetAllCodeSetsResponse>}
   */
  const getAllCodeSets = async (): Promise<IGetAllCodeSetsResponse> => {
    const { data } = await axios.get('/api/codes/');

    return data;
  };

  return {
    getAllCodeSets
  };
};

export default useCodesApi;

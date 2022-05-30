import { AxiosInstance } from 'axios';
import { IListSubmissionsResponse } from 'interfaces/useSubmissionsApi.interface';

/**
 * Returns a set of supported CRUD api methods submissions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSubmissionsApi = (axios: AxiosInstance) => {
  /**
   * Fetch all submissions.
   *
   * @return {*}  {Promise<IListSubmissionsResponse>}
   */
  const listSubmissions = async (): Promise<IListSubmissionsResponse> => {
    const { data } = await axios.get('/api/dwc/submission/list');

    return data;
  };

  return {
    listSubmissions
  };
};

export default useSubmissionsApi;

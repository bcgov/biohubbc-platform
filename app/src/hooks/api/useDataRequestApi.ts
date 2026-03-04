import { AxiosInstance } from 'axios';
import { CreateDataRequestPayload, DataRequestResponse } from 'interfaces/useDataRequestApi.interface';

/**
 * Returns a set of supported api methods for working with data requests.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useDataRequestApi = (axios: AxiosInstance) => {
  /**
   * Creates a new data request for access to secured data.
   *
   * @param {CreateDataRequestPayload} payload
   * @return {Promise<DataRequestResponse>}
   */
  const createDataRequest = async (payload: CreateDataRequestPayload): Promise<DataRequestResponse> => {
    const { data } = await axios.post<DataRequestResponse>('/api/data-request', payload);
    return data;
  };

  return {
    createDataRequest
  };
};

import { AxiosInstance } from 'axios';
import {
  ISecureDataAccessRequestForm
} from 'interfaces/useSecurityApi.interface';

/**
 * Returns a set of supported api methods for working with security.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSecurityApi = (axios: AxiosInstance) => {
  /**
   * Fetch dataset artifacts by datasetId.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<any>}
   */
  const sendSecureArtifactAccessRequest = async (requestData: ISecureDataAccessRequestForm): Promise<boolean> => {
    const { data } = await axios.post(`api/artifact/security/requestAccess`, requestData);

    return data;
  };

  return {
    sendSecureArtifactAccessRequest
  };
};

export default useSecurityApi;

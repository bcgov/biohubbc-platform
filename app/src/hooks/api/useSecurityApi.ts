import { AxiosInstance } from 'axios';
import { ISecurityReason } from 'features/datasets/components/security/SecurityReasonCategory';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import { IListPersecutionHarmResponse } from 'interfaces/useSecurityApi.interface';

/**
 * This hook is used to fetch data from the security api.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSecurityApi = (axios: AxiosInstance) => {
  /**
   * Fetches a list of persecution and harm rules.
   *
   * @return {*}  {Promise<IListPersecutionHarmResponse>}
   */
  const listPersecutionHarmRules = async (): Promise<IListPersecutionHarmResponse> => {
    const { data } = await axios.get('/api/security/persecution-harm/list');

    return data;
  };

  const applySecurityReasonsToArtifacts = async (
    selectedArtifacts: IArtifact[],
    securityReasons: ISecurityReason[]
  ): Promise<any> => {
    const { data } = await axios.post('/api/security/persecution-harm/apply', {
      selectedArtifacts: selectedArtifacts,
      securityReasons: securityReasons
    });

    return data;
  };

  return {
    listPersecutionHarmRules,
    applySecurityReasonsToArtifacts
  };
};

export default useSecurityApi;

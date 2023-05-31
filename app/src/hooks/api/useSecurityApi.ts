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
    selectedArtifacts: { artifact_id: number }[],
    securityReasons: { id: number }[]
  ): Promise<{ artifact_persecution_id: number }[]> => {
    const artifactIds = selectedArtifacts.map((artifact) => artifact.artifact_id);
    const securityReasonIds = securityReasons.map((securityReason) => securityReason.id);

    const { data } = await axios.post('/api/security/persecution-harm/apply', {
      artifactIds: artifactIds,
      securityReasonIds: securityReasonIds
    });

    return data;
  };

  return {
    listPersecutionHarmRules,
    applySecurityReasonsToArtifacts
  };
};

export default useSecurityApi;

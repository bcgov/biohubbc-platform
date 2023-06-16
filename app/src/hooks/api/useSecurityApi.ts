import { AxiosInstance } from 'axios';
import { IListPersecutionHarmResponse, ISecureDataAccessRequestForm } from 'interfaces/useSecurityApi.interface';

/**
 * Returns a set of supported api methods for working with security.
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

  /**
   * @TODO jsdoc
   * @param requestData 
   * @returns 
   */
  const sendSecureArtifactAccessRequest = async (requestData: ISecureDataAccessRequestForm): Promise<boolean> => {
    const { data } = await axios.post(`api/artifact/security/requestAccess`, requestData);

    return data;
  }

  return {
    sendSecureArtifactAccessRequest,
    listPersecutionHarmRules,
    applySecurityReasonsToArtifacts
  };
};

export default useSecurityApi;

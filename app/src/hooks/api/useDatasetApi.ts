import { AxiosInstance } from 'axios';
import { IArtifact } from 'interfaces/useDatasetApi.interface';

/**
 * Returns a set of supported api methods for working with datasets.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useDatasetApi = (axios: AxiosInstance) => {
  /**
   * Fetch dataset data by datasetUUID.
   *
   * @param {string} datasetUUID
   * @return {*}  {Promise<any>}
   */
  const getDataset = async (datasetUUID: string): Promise<any> => {
    const { data } = await axios.get(`api/dataset/${datasetUUID}`);

    return data;
  };

  /**
   * Fetch dataset artifacts by datasetId.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<any>}
   */
  const getDatasetArtifacts = async (datasetId: string): Promise<IArtifact[]> => {
    const { data } = await axios.get(`api/dwc/submission/${datasetId}/artifacts`);

    return data;
  };

  /**
   * Fetch the signed URL of an artifact by its artifact ID.
   *
   * @return {*}  {Promise<string>}
   */
  const getArtifactSignedUrl = async (artifactId: number): Promise<string> => {
    const { data } = await axios.get<string>(`api/artifact/${artifactId}/getSignedUrl`);

    return data;
  };

  return {
    getDataset,
    getDatasetArtifacts,
    getArtifactSignedUrl
  };
};

export default useDatasetApi;

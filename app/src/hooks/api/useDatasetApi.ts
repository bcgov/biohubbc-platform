import { AxiosInstance } from 'axios';
import { IListArtifactsResponse } from 'interfaces/useDatasetApi.interface';
import { IKeywordSearchResponse } from 'interfaces/useSearchApi.interface';

/**
 * Returns a set of supported api methods for working with datasets.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useDatasetApi = (axios: AxiosInstance) => {
  /**
   * Fetch all datasets.
   *
   * @return {*}  {Promise<IElasticsearchResponse<{ datasetTitle: string[] }>>}
   */
  const listAllDatasets = async (): Promise<IKeywordSearchResponse[]> => {
    const { data } = await axios.get(`api/dwc/eml/search`);

    return data;
  };

  /**
   * Fetch dataset metadata by datasetId.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<any>}
   */
  const getDatasetEML = async (datasetId: string): Promise<any> => {
    const { data } = await axios.get(`api/dwc/submission/${datasetId}/get`);

    return data;
  };

  /**
   * Fetch dataset artifacts by datasetId.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<any>}
   */
  const getDatasetArtifacts = async (datasetId: string): Promise<IListArtifactsResponse> => {
    const { data } = await axios.get(`api/dwc/submission/${datasetId}/artifacts`);

    return data;
  };

  return {
    listAllDatasets,
    getDatasetEML,
    getDatasetArtifacts
  };
};

export default useDatasetApi;

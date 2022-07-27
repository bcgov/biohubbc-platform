import { AxiosInstance } from 'axios';
import { Feature, FeatureCollection } from 'geojson';
import { IElasticsearchResponse } from 'interfaces/useSearchApi.interface';

/**
 * Returns a set of supported api methods for working with search functionality
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useDatasetApi = (axios: AxiosInstance) => {
  const listAllDatasets = async (): Promise<IElasticsearchResponse<{ datasetTitle: string[] }>> => {
    const { data } = await axios.get(`api/dwc/eml/search`);

    return data;
  };

  //get the eml
  const getDatasetEML = async (datasetId: string): Promise<any> => {
    const { data } = await axios.get(`api/dwc/submission/${datasetId}/get`);

    return data;
  };

  //TODO: get the spatial for each dataset, filter by datasetId when ready
  const getSpatialDatabyDatasetId = async (criteria: {
    boundary: Feature;
    type: string[];
  }): Promise<FeatureCollection[]> => {
    const { data } = await axios.get(`/api/dwc/spatial/search`, {
      params: { boundary: criteria.boundary, type: criteria.type }
    });
    return data;
  };

  return {
    listAllDatasets,
    getDatasetEML,
    getSpatialDatabyDatasetId
  };
};

export default useDatasetApi;

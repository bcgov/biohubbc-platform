import { AxiosInstance } from 'axios';
import { Feature, FeatureCollection } from 'geojson';
import {
  IElasticsearchResponse,
  IGetSearchResultsResponse,
  IKeywordSearchResult
} from 'interfaces/useSearchApi.interface';

/**
 * Returns a set of supported api methods for working with search functionality
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useSearchApi = (axios: AxiosInstance) => {
  /**
   * Get search results (spatial)
   *
   * @return {*}  {Promise<IGetSearchResultsResponse[]>}
   */
  const getSearchResults = async (): Promise<IGetSearchResultsResponse[]> => {
    const { data } = await axios.get(`/api/search`);

    return data;
  };

  const getSpatialData = async (criteria: {
    boundary: Feature;
    type: string[];
    zoom: number; // TODO include in request params when backend is updated to receive it
  }): Promise<FeatureCollection[]> => {
    const { data } = await axios.get(`/api/dwc/spatial/search`, {
      params: { boundary: criteria.boundary, type: criteria.type }
    });
    return data;
  };

  const listAllDatasets = async (): Promise<IElasticsearchResponse<{ datasetTitle: string[] }>> => {
    const { data } = await axios.get(`api/dwc/eml/search`);

    return data;
  };

  /**
   * Get keyword search results
   *
   * @param searchQuery The keywords to search for
   * @returns {*} {Promise<>}
   */
  const keywordSearch = async (searchQuery: string): Promise<IElasticsearchResponse<unknown, IKeywordSearchResult>> => {
    const { data } = await axios.get(`api/dwc/eml/search?terms=${searchQuery}`);

    return data;
  };

  return {
    getSearchResults,
    listAllDatasets,
    keywordSearch,
    getSpatialData
  };
};

export default useSearchApi;

/**
 * Returns a set of supported api methods for working with public search functionality.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const usePublicSearchApi = (axios: AxiosInstance) => {
  /**
   * Get public search results (spatial)
   *
   * @return {*}  {Promise<IGetSearchResultsResponse[]>}
   */
  const getSearchResults = async (): Promise<IGetSearchResultsResponse[]> => {
    const { data } = await axios.get(`/api/public/search`);

    return data;
  };

  return {
    getSearchResults
  };
};

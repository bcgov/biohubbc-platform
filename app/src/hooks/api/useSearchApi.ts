import { AxiosInstance } from 'axios';
import { IGetMapOccurrenceData } from 'components/map/OccurrenceFeaturePopup';
import { Feature } from 'geojson';
import { IGetSearchResultsResponse } from 'interfaces/useSearchApi.interface';
import qs from 'qs';

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

  /**
   * Get occurrence map data
   *
   * @param {Feature} [spatialSearch]
   * @return {*}  {Promise<IGetMapOccurrenceData[]>}
   */
  const getMapOccurrenceData = async (spatialSearch?: Feature): Promise<IGetMapOccurrenceData[]> => {
    const { data } = await axios.get(`/api/dwc/submission/occurrence/list`, {
      params: { spatial: qs.stringify(spatialSearch) }
    });
    return data;
  };

  return {
    getSearchResults,
    getMapOccurrenceData
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

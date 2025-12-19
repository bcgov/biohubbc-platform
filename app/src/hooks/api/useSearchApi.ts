import { AxiosInstance } from 'axios';
import { ISearchFeaturesRequest, SearchFeatureResult } from 'interfaces/useSearchApi.interface';

/**
 * Returns API methods for searching features.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useSearchApi = (axios: AxiosInstance) => {
  /**
   * Search for features by keywords and/or property filters.
   *
   * @param {ISearchFeaturesRequest} params - Search parameters
   * @return {Promise<SearchFeatureResult[]>} Array of matching features sorted by relevancy
   */
  const searchFeatures = async (params: ISearchFeaturesRequest): Promise<SearchFeatureResult[]> => {
    const { data } = await axios.post<SearchFeatureResult[]>('/api/search', params);

    return data;
  };

  return {
    searchFeatures
  };
};
